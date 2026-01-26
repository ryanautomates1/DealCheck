import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

// Hardcoded fallbacks for client-side (these are public values, safe to embed)
const SUPABASE_URL_FALLBACK = 'https://zgysztqjsocznebtojbr.supabase.co'
const SUPABASE_ANON_KEY_FALLBACK = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpneXN6dHFqc29jem5lYnRvamJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzMzAzNjUsImV4cCI6MjA4NDkwNjM2NX0.O5VqCpiygA2UAX6Oyv5TzWzYP9JLJvts6MSfBmLXKZY'

export function createClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || SUPABASE_URL_FALLBACK
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY_FALLBACK
  
  return createBrowserClient(url, key)
}
