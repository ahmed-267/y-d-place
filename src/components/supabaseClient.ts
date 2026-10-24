import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Set them in .env.local — hardcoded fallbacks were removed for security.'
  )
}

// Anon key is public by design; never put service-role keys here.
// Bound network requests so unavailable auth/database services release form spinners.
const boundedFetch: typeof fetch = async (input, init) => {
  const controller = new AbortController();
  const upstream = init?.signal;
  const abort = () => controller.abort();
  if (upstream?.aborted) controller.abort();
  upstream?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 20000);
  try { return await fetch(input, { ...init, signal: controller.signal }); }
  finally { clearTimeout(timer); upstream?.removeEventListener('abort', abort); }
};
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: boundedFetch },
})

/** Separate client for one-off auth checks (e.g. manager PIN) without clobbering the active session. */
export const createEphemeralSupabase = () => createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})
