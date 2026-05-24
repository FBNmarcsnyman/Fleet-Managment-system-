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

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
  global: {
    fetch: fetchWithTimeout,
  },
});
