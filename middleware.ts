import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// Routes that require authentication
const protectedRoutes = ['/dashboard', '/deals', '/pricing', '/debug']
// Routes that should redirect to dashboard if already authenticated
const authRoutes = ['/auth/login', '/auth/signup']
// Routes that are always public
const publicRoutes = ['/', '/share', '/privacy', '/api/webhooks', '/auth/callback']

export async function middleware(request: NextRequest) {
  // Skip middleware if not using Supabase
  if (process.env.USE_SUPABASE !== 'true') {
    return NextResponse.next()
  }

  const { response, user } = await updateSession(request)
  const { pathname } = request.nextUrl

  // Check if route matches any pattern
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))
  const isAuthRoute = authRoutes.some(route => pathname.startsWith(route))
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))

  // Redirect unauthenticated users from protected routes to login
  if (isProtectedRoute && !user) {
    const loginUrl = new URL('/auth/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Redirect authenticated users from auth routes to dashboard
  if (isAuthRoute && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api routes that don't need auth
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
