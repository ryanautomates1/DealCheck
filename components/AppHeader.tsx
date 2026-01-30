'use client'

import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'

/**
 * Shared header for authenticated app pages: DealMetrics, tier badge, email, Sign out.
 * Sticky so it stays visible when scrolling.
 */
export function AppHeader() {
  const { user, profile, signOut } = useAuth()

  return (
    <header className="sticky top-0 z-50 bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-2xl font-bold text-gray-900 hover:text-gray-700">
              DealMetrics
            </Link>
            {profile && (
              <span
                className={`px-2 py-1 rounded-full text-xs font-medium ${
                  profile.subscription_tier === 'pro'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {profile.subscription_tier === 'pro' ? 'Pro' : 'Free'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            {profile && profile.subscription_tier === 'free' && (
              <div className="hidden sm:flex items-center gap-2 text-sm text-gray-600">
                <span>
                  <strong>{Math.max(0, 2 - (profile.imports_this_month || 0))}</strong> imports remaining
                </span>
                <Link href="/pricing" className="text-blue-600 hover:text-blue-800 font-medium">
                  Upgrade
                </Link>
              </div>
            )}
            {user && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600 hidden sm:inline">{user.email}</span>
                <button
                  type="button"
                  onClick={signOut}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
