import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, getClientIdentifier } from '@/lib/rate-limit'
import { NextResponse } from 'next/server'

const AUTH_CALLBACK_LIMIT = 20
const AUTH_CALLBACK_WINDOW_MS = 60_000

export async function GET(request: Request) {
  const clientId = getClientIdentifier(request)
  const { allowed } = checkRateLimit(`auth-callback:${clientId}`, AUTH_CALLBACK_LIMIT, AUTH_CALLBACK_WINDOW_MS)
  if (!allowed) {
    const { origin } = new URL(request.url)
    return NextResponse.redirect(`${origin}/auth/login?error=Too many attempts`)
  }

  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Return to login with error
  return NextResponse.redirect(`${origin}/auth/login?error=Could not authenticate`)
}
