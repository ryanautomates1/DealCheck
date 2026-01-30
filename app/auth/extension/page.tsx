'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ExtensionLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    // Add timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      setLoading(false)
      setError('Connection timed out. Please check your internet connection and try again.')
    }, 15000) // 15 second timeout

    try {
      console.log('[ExtensionAuth] Creating Supabase client...')
      const supabase = createClient()
      
      console.log('[ExtensionAuth] Attempting sign in...')
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      
      clearTimeout(timeoutId)
      console.log('[ExtensionAuth] Sign in result:', { hasData: !!data, hasError: !!error })

      if (error) {
        console.error('[ExtensionAuth] Auth error:', error)
        setError(error.message)
        setLoading(false)
        return
      }

      if (!data?.session) {
        console.error('[ExtensionAuth] No session returned')
        setError('Login failed. Please check your credentials and try again.')
        setLoading(false)
        return
      }

      console.log('[ExtensionAuth] Success, redirecting...')
      // Redirect to success page with access and refresh tokens (refresh enables long-lived sessions)
      const refresh = data.session.refresh_token ?? ''
      const successUrl = `/auth/extension/success?token=${encodeURIComponent(data.session.access_token)}&email=${encodeURIComponent(email)}&refresh_token=${encodeURIComponent(refresh)}`
      window.location.href = successUrl
    } catch (err: any) {
      clearTimeout(timeoutId)
      console.error('[ExtensionAuth] Caught error:', err)
      setError(err.message || 'An error occurred. Please try again.')
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
          </form>

          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600 text-center">
              This will connect the DealMetrics Chrome extension to your account, allowing you to import listings directly from Zillow.
            </p>
          </div>
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
