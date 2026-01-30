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

const AUTH_TIMEOUT_MS = 25000

/** Check if Supabase Auth is reachable. Uses auth health endpoint. Timeout 8s. */
export async function checkSupabaseReachable(): Promise<boolean> {
  const { url, key } = getSupabaseConfig()
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch(`${url}/auth/v1/health`, {
      method: 'GET',
      headers: { apikey: key },
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    return res.ok
  } catch {
    clearTimeout(timeoutId)
    return false
  }
}

/** Sign in via direct Auth API with timeout. Bypasses Supabase client to avoid hangs. */
export async function signInWithPasswordDirect(
  email: string,
  password: string
): Promise<{ access_token: string; refresh_token: string }> {
  const { url, key } = getSupabaseConfig()
  const authUrl = `${url}/auth/v1/token?grant_type=password`
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), AUTH_TIMEOUT_MS)
  let res: Response
  try {
    res = await fetch(authUrl, {
      method: 'POST',
      headers: {
        apikey: key,
        'Content-Type': 'application/json',
        'X-Client-Info': 'dealmetrics-web',
      },
      body: JSON.stringify({
        email,
        password,
        gotrue_meta_security: {},
      }),
      signal: controller.signal,
    })
  } catch (err: any) {
    clearTimeout(timeoutId)
    if (err?.name === 'AbortError') {
      throw new Error('Sign-in timed out. Try again.')
    }
    const msg = err?.message || String(err)
    if (/failed to fetch|network|load/i.test(msg)) {
      throw new Error('Network error: cannot reach Supabase. Check your connection or try again.')
    }
    throw new Error(msg || 'Sign-in failed')
  }
  clearTimeout(timeoutId)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = data?.error_description ?? data?.msg ?? data?.error ?? `HTTP ${res.status}`
    console.error('[Supabase Auth] Sign-in failed:', res.status, data)
    throw new Error(typeof msg === 'string' ? msg : 'Sign-in failed')
  }
  const access_token = data.access_token
  const refresh_token = data.refresh_token ?? ''
  if (!access_token) throw new Error('No access token in response')
  return { access_token, refresh_token }
}
