import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local'
  );
}

// Browser fetch has no default timeout. Free-tier Supabase nano instances can
// take 10+ seconds on cold start, so this gives every Supabase request a 30s
// ceiling. Without this, a stalled request would hang forever; with too short
// a value, cold-start signInWithPassword fails before the project wakes up.
const FETCH_TIMEOUT_MS = 30000;

const fetchWithTimeout: typeof fetch = async (input, init) => {
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), FETCH_TIMEOUT_MS);

  // If the caller passed their own AbortSignal, fold it into ours so caller-
  // initiated aborts still propagate to the underlying fetch.
  const callerSignal = init?.signal;
  if (callerSignal) {
    if (callerSignal.aborted) {
      timeoutController.abort();
    } else {
      callerSignal.addEventListener('abort', () => timeoutController.abort(), { once: true });
    }
  }

  try {
    return await fetch(input, { ...init, signal: timeoutController.signal });
  } finally {
    clearTimeout(timeoutId);
  }
};

// Root cause of the "sign in hangs after page reload" loop Marc has been
// hitting for a week: supabase-js's default auth lock (NavigatorLock) uses
// the browser's Web Locks API to serialize auth operations across tabs.
// When the page reloads mid-operation (token refresh, signInWithPassword,
// initial session probe), the lock can persist in the browser's lock
// registry, and the next supabase client instance waits on it FOREVER.
//
// All previous fixes (storage scrub, 15s sign-in race, 12s isAuthReady
// fallback, in-flight hydrate guard) were band-aids around this deadlock.
// This is the actual fix: a no-op lock that just runs the callback. For a
// single-page browser app the cross-tab serialization the default lock
// provides is theoretical (we don't open the app in two tabs); the
// deadlock is real and repeatable.
//
// Refs: github.com/supabase/supabase-js#869 and many similar issues.
const noopLock = async <R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> => fn();

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    lock: noopLock,
  },
  global: {
    fetch: fetchWithTimeout,
  },
});

// Upload a file to a Supabase Storage bucket and return its public URL.
// Used for driver licences (and reusable for PODs / supplier docs later).
export const uploadFile = async (
  bucket: string,
  path: string,
  file: File,
): Promise<{ url: string | null; error: string | null }> => {
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: true,
    contentType: file.type || undefined,
  });
  if (error) return { url: null, error: error.message };
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { url: data.publicUrl, error: null };
};

// A write can silently fail when the access token has gone stale (laptop
// asleep, tab open for hours): the database sees no authenticated user, so
// row-level security rejects the row. These are the error shapes that mean
// "your session, not your data" — used to decide whether a one-time session
// refresh + retry is worth attempting.
export const isAuthLikeError = (error: any): boolean => {
  if (!error) return false;
  const code = String(error.code ?? error.status ?? '');
  const msg = String(error.message ?? '').toLowerCase();
  return (
    code === '401' ||
    code === '403' ||
    code === '42501' ||      // postgres: insufficient_privilege (RLS denial)
    code === 'PGRST301' ||   // postgrest: JWT expired / not authenticated
    msg.includes('jwt') ||
    msg.includes('token is expired') ||
    msg.includes('not authenticated') ||
    msg.includes('row-level security') ||
    msg.includes('row level security')
  );
};

// Runs a Supabase write; if it fails with an auth/session error, refreshes the
// session once and retries. Accepts the Supabase query builder (a thenable),
// so `op` is typed as PromiseLike rather than a strict Promise.
export const runWrite = async (
  op: () => PromiseLike<{ data: any; error: any }>,
): Promise<{ data: any; error: any }> => {
  let res = await op();
  if (res.error && isAuthLikeError(res.error)) {
    try {
      await supabase.auth.refreshSession();
    } catch (e) {
      console.warn('[supabase] session refresh failed during write retry:', e);
    }
    res = await op();
  }
  return res;
};

// ---------------------------------------------------------------------------
// Direct REST writes — the freeze-proof path.
//
// We confirmed the "LoadCon won't create / hangs on Creating…" bug is the
// supabase-js client wedging on its own session/token handling: the request
// never even leaves the browser (no row ever reaches Postgres). To make a write
// that CAN'T be held hostage by that internal state, we talk to PostgREST with a
// plain fetch, using the access token read straight out of localStorage. Plain
// GETs work fine, so the network/token are healthy — it's only the client's
// request pipeline that gets stuck. This sidesteps it entirely.
// ---------------------------------------------------------------------------

const PROJECT_REF = (supabaseUrl.match(/https:\/\/([^.]+)\./) || [])[1] || '';
const AUTH_STORAGE_KEY = `sb-${PROJECT_REF}-auth-token`;

const readStoredSession = (): { access_token?: string; refresh_token?: string } | null => {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw);
    // supabase-js has used a couple of shapes over versions; cover both.
    return j?.access_token ? j : (j?.currentSession || j?.session || null);
  } catch {
    return null;
  }
};

const raced = <T,>(p: Promise<T>, ms: number): Promise<T> =>
  Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error('__timed_out__')), ms))]);

// Exchange the stored refresh token for a fresh access token WITHOUT going
// through supabase-js (which may be wedged). Persists the new session back so
// subsequent calls use it too.
const rawRefreshToken = async (): Promise<string | null> => {
  const stored = readStoredSession();
  const refresh_token = stored?.refresh_token;
  if (!refresh_token) return null;
  try {
    const resp = await raced(fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { apikey: supabaseAnonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token }),
    }), 12000);
    if (!resp.ok) return null;
    const j = await resp.json();
    if (j?.access_token) {
      try { localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(j)); } catch { /* ignore */ }
      return j.access_token as string;
    }
  } catch { /* fall through */ }
  return null;
};

// Insert a row via direct REST and return the created record (or an error).
// Tries the current token; on 401/JWT-expired it raw-refreshes once and retries.
export const directInsert = async (
  table: string,
  row: Record<string, any>,
): Promise<{ data: any; error: { message: string } | null }> => {
  let token = readStoredSession()?.access_token || null;
  if (!token) {
    token = await rawRefreshToken();
    if (!token) return { data: null, error: { message: 'Your session has expired — please sign out and back in.' } };
  }

  const attempt = async (tok: string) => raced(fetch(`${supabaseUrl}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${tok}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(row),
  }), 15000);

  try {
    let resp = await attempt(token);
    if (resp.status === 401 || resp.status === 403) {
      const fresh = await rawRefreshToken();
      if (fresh) resp = await attempt(fresh);
    }
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      return { data: null, error: { message: `${resp.status}: ${text || resp.statusText}` } };
    }
    const json = await resp.json().catch(() => null);
    return { data: Array.isArray(json) ? json[0] : json, error: null };
  } catch (e) {
    const msg = e instanceof Error && e.message === '__timed_out__'
      ? 'The save timed out — please check your connection and try again.'
      : (e instanceof Error ? e.message : 'Network error');
    return { data: null, error: { message: msg } };
  }
};
