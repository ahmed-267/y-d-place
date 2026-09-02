import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://vjevmxqiyaahkstpgvjo.supabase.co'
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZqZXZteHFpeWFhaGtzdHBndmpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3OTI1MzksImV4cCI6MjA4NzM2ODUzOX0.hYWXcr0Tz00-7PEpGyjr2Lqz1BrvoEQ1GUt2d76riNk'

// Prefer env vars in production. The anon key is public by design; never put service-role keys here.
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
