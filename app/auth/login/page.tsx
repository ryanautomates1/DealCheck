'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient, checkSupabaseReachable, signInWithPasswordDirect } from '@/lib/supabase/client'

const SUPABASE_CHECKLIST = 'Supabase Dashboard: Project Settings → General (Resume if paused). Auth → Providers → Email enabled. Auth → URL Configuration → Site URL set to your app URL (e.g. https://getdealmetrics.com).'

function LoginForm() {
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showRetry, setShowRetry] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setShowRetry(false)
    setLoading(true)

    try {
      const reachable = await checkSupabaseReachable()
      if (!reachable) {
        setError(`Cannot reach Supabase Auth. ${SUPABASE_CHECKLIST}`)
        setShowRetry(true)
        setLoading(false)
        return
      }

      const { access_token, refresh_token } = await signInWithPasswordDirect(email, password)
      const supabase = createClient()
      const { data: sessionData, error: sessionError } = await supabase.auth.setSession({ access_token, refresh_token })
      if (sessionError) {
        setError(sessionError.message || 'Session could not be saved. Try again.')
        setShowRetry(true)
        setLoading(false)
        return
      }
      if (!sessionData?.session) {
        setError('Session could not be saved. Check browser cookie settings and try again.')
        setShowRetry(true)
        setLoading(false)
        return
      }
      // Full page redirect so the next request sends cookies and middleware sees the session
      const next = searchParams.get('next')
      const path = next && next.startsWith('/') ? next : '/dashboard'
      window.location.href = path
    } catch (err: any) {
      console.error('[Login] Caught error:', err)
      setError(err.message || 'An error occurred')
      setShowRetry(true)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">DealMetrics</h1>
          <p className="text-blue-200">Analyze real estate deals with confidence</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">Sign in</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
              <p className="mt-1 text-xs text-gray-500">Open DevTools (F12) → Console for more details.</p>
              {showRetry && (
                <button
                  type="button"
                  onClick={() => { setError(null); setShowRetry(false); }}
                  className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-800"
                >
                  Dismiss and try again
                </button>
              )}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
            {loading && (
              <p className="mt-2 text-center text-sm text-gray-500">
                This may take 10–30 seconds. Please wait.
              </p>
            )}
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-600">
              Don&apos;t have an account?{' '}
              <Link href="/auth/signup" className="text-blue-600 hover:text-blue-800 font-medium">
                Sign up
              </Link>
            </p>
          </div>
          <div className="mt-4 text-center">
            <Link href="/privacy" className="text-xs text-gray-500 hover:text-gray-700">
              Privacy Policy
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <p className="text-blue-200">Loading...</p>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
