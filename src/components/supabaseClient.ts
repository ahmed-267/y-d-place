import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Set them in .env.local — hardcoded fallbacks were removed for security.'
  )
}

// Anon key is public by design; never put service-role keys here.
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/** Separate client for one-off auth checks (e.g. manager PIN) without clobbering the active session. */
export const createEphemeralSupabase = () => createClient(supabaseUrl, supabaseAnonKey)
