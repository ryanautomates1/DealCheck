import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

// Hardcoded fallbacks for client-side (these are public values, safe to embed)
const SUPABASE_URL_FALLBACK = 'https://zgysztqjsocznebtojbr.supabase.co'
const SUPABASE_ANON_KEY_FALLBACK = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpneXN6dHFqc29jem5lYnRvamJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzMzAzNjUsImV4cCI6MjA4NDkwNjM2NX0.O5VqCpiygA2UAX6Oyv5TzWzYP9JLJvts6MSfBmLXKZY'

export function getSupabaseConfig(): { url: string; key: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || SUPABASE_URL_FALLBACK
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY_FALLBACK
  return { url, key }
}

export function createClient(): SupabaseClient {
  const { url, key } = getSupabaseConfig()
  return createBrowserClient(url, key)
}

/** Check if Supabase is reachable (e.g. project not paused). Timeout 8s. */
export async function checkSupabaseReachable(): Promise<boolean> {
  const { url, key } = getSupabaseConfig()
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch(`${url}/rest/v1/`, {
      method: 'GET',
      headers: { apikey: key, Accept: 'application/json' },
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    return res.ok || res.status === 404 // 404 still means project is up
  } catch {
    clearTimeout(timeoutId)
    return false
  }
}
