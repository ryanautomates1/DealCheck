'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'
import { AppHeader } from '@/components/AppHeader'

function PricingContent() {
  const { user, profile, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const cancelled = searchParams.get('cancelled')

  const handleUpgrade = async () => {
    if (!user) {
      router.push('/auth/login?next=/pricing')
      return
    }

    setCheckoutLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to create checkout session')
        return
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url
      }
    } catch (err) {
      setError('Something went wrong. Please try again.')
    } finally {
      setCheckoutLoading(false)
    }
  }

  const isPro = profile?.subscription_tier === 'pro'

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <AppHeader />

      <div className="max-w-5xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-blue-200">
            Start analyzing deals for free. Upgrade when you need more.
          </p>
        </div>

        {cancelled && (
          <div className="max-w-md mx-auto mb-8 p-4 bg-yellow-500/20 border border-yellow-500/50 rounded-lg text-center">
            <p className="text-yellow-200">
              Checkout cancelled. No charges were made.
            </p>
          </div>
        )}

        {error && (
          <div className="max-w-md mx-auto mb-8 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-center">
            <p className="text-red-200">{error}</p>
          </div>
        )}

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Free Tier */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">Free</h2>
              <div className="flex items-baseline">
                <span className="text-4xl font-bold text-white">$0</span>
                <span className="text-white/60 ml-2">/month</span>
              </div>
            </div>

            <ul className="space-y-4 mb-8">
              <li className="flex items-start">
                <svg className="w-5 h-5 text-green-400 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-white/80">Sign in to use the extension on listing sites</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-green-400 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-white/80">Unlimited manual deal entries</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-green-400 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-white/80">Full underwriting analysis</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-green-400 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-white/80">Holding period projections</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-green-400 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-white/80">Shareable deal reports</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-amber-400 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="text-white/80">Saving deals from extension and Compare require Pro</span>
              </li>
            </ul>

            {!isPro && (
              <div className="text-center">
                {profile?.subscription_tier === 'free' ? (
                  <span className="inline-block px-6 py-3 bg-white/20 text-white rounded-lg font-medium">
                    Current Plan
                  </span>
                ) : (
                  <Link
                    href="/auth/signup"
                    className="inline-block px-6 py-3 bg-white/20 text-white rounded-lg font-medium hover:bg-white/30 transition-colors"
                  >
                    Get Started Free
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Pro Tier */}
          <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-8 border border-blue-400/50 relative">
            <div className="absolute top-0 right-0 bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg">
              RECOMMENDED
            </div>

            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">Pro</h2>
              <div className="flex items-baseline">
                <span className="text-4xl font-bold text-white">$9.99</span>
                <span className="text-white/60 ml-2">/month</span>
              </div>
            </div>

            <ul className="space-y-4 mb-8">
              <li className="flex items-start">
                <svg className="w-5 h-5 text-green-300 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-white/90">Everything in Free</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-green-300 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-white/90">
                  <strong>Save deals from the extension</strong> (unlimited)
                </span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-green-300 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-white/90">
                  <strong>Compare</strong> up to 5 deals side-by-side
                </span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-green-300 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-white/90">Priority support</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-green-300 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-white/90">Early access to new features</span>
              </li>
            </ul>

            <div className="text-center">
              {isPro ? (
                <span className="inline-block px-6 py-3 bg-white/20 text-white rounded-lg font-medium">
                  Current Plan
                </span>
              ) : (
                <button
                  onClick={handleUpgrade}
                  disabled={checkoutLoading}
                  className="w-full px-6 py-3 bg-white text-blue-700 rounded-lg font-medium hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {checkoutLoading ? 'Loading...' : 'Upgrade to Pro'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-16 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-white text-center mb-8">
            Frequently Asked Questions
          </h2>
          
          <div className="space-y-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <h3 className="text-lg font-semibold text-white mb-2">
                What can I do with the Free plan?
              </h3>
              <p className="text-white/70">
                Sign in to use the extension on Zillow and other supported sites to analyze listings. 
                You can create unlimited deals manually on the website. Saving a listing from the 
                extension to your dashboard and using Compare require Pro.
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <h3 className="text-lg font-semibold text-white mb-2">
                What does Pro include?
              </h3>
              <p className="text-white/70">
                Pro lets you save deals from the extension to your dashboard with no limit, and 
                compare up to 5 deals side-by-side. You get everything in Free plus these features 
                for $9.99/month.
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <h3 className="text-lg font-semibold text-white mb-2">
                Can I cancel anytime?
              </h3>
              <p className="text-white/70">
                Yes! You can cancel your Pro subscription at any time. You&apos;ll continue 
                to have Pro access until the end of your billing period.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PricingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center"><p className="text-white">Loading...</p></div>}>
      <PricingContent />
    </Suspense>
  )
}
