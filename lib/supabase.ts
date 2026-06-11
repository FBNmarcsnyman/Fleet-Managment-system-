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
