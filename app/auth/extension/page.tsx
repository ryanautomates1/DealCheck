'use client'

import { useState } from 'react'
import { createClient, checkSupabaseReachable } from '@/lib/supabase/client'

const SUPABASE_CHECKLIST = 'In Supabase Dashboard: Project Settings → General → click "Resume project" if paused. Ensure Auth → Providers → Email is enabled.'

export default function ExtensionLoginPage() {
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
      // 1. Check Supabase is reachable (catches paused project, network issues)
      console.log('[ExtensionAuth] Checking Supabase connectivity...')
      const reachable = await checkSupabaseReachable()
      if (!reachable) {
        setError(`Cannot reach Supabase. Is your project paused? ${SUPABASE_CHECKLIST}`)
        setShowRetry(true)
        setLoading(false)
        return
      }
      console.log('[ExtensionAuth] Supabase reachable, signing in...')

      // 2. Sign in (with long timeout for cold starts)
      const timeoutMs = 45000
      const timeoutId = setTimeout(() => {
        setLoading(false)
        setError(`Sign-in timed out. ${SUPABASE_CHECKLIST}`)
        setShowRetry(true)
      }, timeoutMs)

      const supabase = createClient()
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
      clearTimeout(timeoutId)

      if (authError) {
        setError(authError.message)
        setLoading(false)
        return
      }
      if (!data?.session) {
        setError('Login failed. Please check your credentials and try again.')
        setLoading(false)
        return
      }

      const refresh = data.session.refresh_token ?? ''
      const successUrl = `/auth/extension/success?token=${encodeURIComponent(data.session.access_token)}&email=${encodeURIComponent(email)}&refresh_token=${encodeURIComponent(refresh)}`
      window.location.href = successUrl
    } catch (err: any) {
      console.error('[ExtensionAuth] Caught error:', err)
      setError(err.message || 'An error occurred. Please try again.')
      setShowRetry(true)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Connect Extension</h1>
          <p className="text-blue-200">Sign in to link your DealMetrics account with the Chrome extension</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Sign in to your account</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
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
              {loading ? 'Connecting...' : 'Connect Extension'}
            </button>
            {loading && (
              <p className="mt-2 text-center text-sm text-gray-500">
                This may take 10–30 seconds. Please wait.
              </p>
            )}
          </form>

          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600 text-center">
              This will connect the DealMetrics Chrome extension to your account, allowing you to import listings directly from Zillow.
            </p>
          </div>
          <p className="mt-4 text-center text-xs text-gray-400">
            If sign-in times out: Supabase Dashboard → your project → Settings → General → Resume project (if paused).
          </p>
        </div>

        <p className="mt-6 text-center text-blue-200 text-sm">
          Don&apos;t have an account?{' '}
          <a href="/auth/signup" className="text-white hover:underline font-medium">
            Sign up for free
          </a>
        </p>
      </div>
    </div>
  )
}
