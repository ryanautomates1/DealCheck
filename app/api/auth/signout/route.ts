import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/config'

/**
 * POST /api/auth/signout
 * Signs out the user and clears auth cookies via the response.
 * Call this from the client before redirecting to login so the next request has no session.
 */
export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true })

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return response
  }

  const supabase = createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: { path?: string; maxAge?: number; sameSite?: 'lax' | 'strict' | 'none'; httpOnly?: boolean; secure?: boolean }) {
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: { path?: string; maxAge?: number; sameSite?: 'lax' | 'strict' | 'none'; httpOnly?: boolean; secure?: boolean }) {
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  await supabase.auth.signOut()

  return response
}
