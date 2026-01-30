'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient, checkSupabaseReachable } from '@/lib/supabase/client'

const SUPABASE_CHECKLIST = 'In Supabase Dashboard: Project Settings → General → click "Resume project" if paused. Ensure Auth → Providers → Email is enabled.'

export default function LoginPage() {
  const router = useRouter()
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
        setError(`Cannot reach Supabase. Is your project paused? ${SUPABASE_CHECKLIST}`)
        setShowRetry(true)
        setLoading(false)
        return
      }

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

      router.push('/dashboard')
      router.refresh()
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
        </div>
      </div>
    </div>
  )
}
