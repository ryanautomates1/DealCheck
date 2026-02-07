'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Deal, Analysis } from '@/lib/types'
import { AppHeader } from '@/components/AppHeader'
import { useAuth } from '@/components/AuthProvider'

const MAX_COMPARE = 5
const MIN_COMPARE = 2

interface DealWithAnalysis {
  deal: Deal
  latestAnalysis: Analysis | null
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function CompareContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { profile, loading: authLoading } = useAuth()
  const [dealsWithAnalyses, setDealsWithAnalyses] = useState<DealWithAnalysis[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const idsParam = searchParams.get('ids')
    if (!idsParam?.trim()) {
      router.replace('/dashboard')
      return
    }
    const ids = idsParam.split(',').map((id) => id.trim()).filter(Boolean)
    if (ids.length < MIN_COMPARE || ids.length > MAX_COMPARE) {
      setError('Select 2 to 5 deals to compare.')
      setLoading(false)
      return
    }
    // Only fetch when Pro (paywall is shown via render below when !pro)
    if (profile?.subscription_tier !== 'pro') {
      setLoading(false)
      return
    }

    const fetchAll = async () => {
      setLoading(true)
      setError(null)
      const results: DealWithAnalysis[] = []
      for (const id of ids) {
        try {
          const [dealRes, analysesRes] = await Promise.all([
            fetch(`/api/deals/${id}`),
            fetch(`/api/deals/${id}/analyses`),
          ])
          if (!dealRes.ok) {
            if (dealRes.status === 404) {
              setError('One or more deals could not be found.')
              setLoading(false)
              return
            }
            throw new Error('Failed to fetch deal')
          }
          const dealData = await dealRes.json()
          const deal: Deal = dealData.deal
          let latestAnalysis: Analysis | null = null
          if (analysesRes.ok) {
            const analysesData = await analysesRes.json()
            if (analysesData.analyses?.length > 0) {
              const sorted = analysesData.analyses.sort(
                (a: Analysis, b: Analysis) =>
                  new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
              )
              latestAnalysis = sorted[0]
            }
          }
          results.push({ deal, latestAnalysis })
        } catch (e) {
          console.error(e)
          setError('Failed to load one or more deals.')
          setLoading(false)
          return
        }
      }
      setDealsWithAnalyses(results)
      setLoading(false)
    }

    fetchAll()
  }, [searchParams, router, profile?.subscription_tier])

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AppHeader />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    )
  }
  if (profile?.subscription_tier !== 'pro') {
    return (
      <div className="min-h-screen bg-gray-50">
        <AppHeader />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="max-w-md mx-auto text-center py-12 px-6 bg-white rounded-xl border border-gray-200 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Upgrade to Pro to compare deals</h2>
            <p className="text-gray-600 mb-6">Side-by-side comparison is a Pro feature. Upgrade to compare your listings.</p>
            <Link
              href="/pricing"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              View pricing
            </Link>
            <div className="mt-4">
              <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700">
                Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AppHeader />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <p className="text-gray-500">Loading comparison...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AppHeader />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <p className="text-red-600 mb-4">{error}</p>
          <Link href="/dashboard" className="text-blue-600 hover:underline font-medium">
            Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  const metricClass = (value: number, good: (v: number) => boolean, ok: (v: number) => boolean) => {
    if (good(value)) return 'text-green-600 font-semibold'
    if (ok(value)) return 'text-yellow-600 font-semibold'
    return 'text-gray-700'
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Compare listings</h1>
          <Link
            href="/dashboard"
            className="text-sm font-medium text-blue-600 hover:text-blue-800"
          >
            Back to Dashboard
          </Link>
        </div>

        <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40">
                  Metric
                </th>
                {dealsWithAnalyses.map(({ deal }) => (
                  <th key={deal.id} className="px-4 py-3 text-left text-sm font-medium text-gray-900 whitespace-nowrap">
                    <Link href={`/deals/${deal.id}`} className="hover:text-blue-600 hover:underline">
                      {deal.address || 'Unknown address'}
                    </Link>
                    <div className="text-xs font-normal text-gray-500 mt-0.5">
                      {formatCurrency(deal.listPrice)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {/* Property */}
              <tr className="bg-gray-50">
                <td className="px-4 py-2 text-xs font-medium text-gray-500 uppercase">List Price</td>
                {dealsWithAnalyses.map(({ deal }) => (
                  <td key={deal.id} className="px-4 py-2 text-sm text-gray-900">
                    {formatCurrency(deal.listPrice)}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="px-4 py-2 text-xs font-medium text-gray-500 uppercase">Beds / Baths</td>
                {dealsWithAnalyses.map(({ deal }) => (
                  <td key={deal.id} className="px-4 py-2 text-sm text-gray-900">
                    {deal.beds != null && deal.baths != null ? `${deal.beds} / ${deal.baths}` : '—'}
                  </td>
                ))}
              </tr>
              <tr className="bg-gray-50">
                <td className="px-4 py-2 text-xs font-medium text-gray-500 uppercase">Sqft</td>
                {dealsWithAnalyses.map(({ deal }) => (
                  <td key={deal.id} className="px-4 py-2 text-sm text-gray-900">
                    {deal.sqft != null ? deal.sqft.toLocaleString() : '—'}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="px-4 py-2 text-xs font-medium text-gray-500 uppercase">Type</td>
                {dealsWithAnalyses.map(({ deal }) => (
                  <td key={deal.id} className="px-4 py-2 text-sm text-gray-900">
                    {deal.propertyType || '—'}
                  </td>
                ))}
              </tr>
              {/* Year 1 metrics */}
              <tr className="bg-blue-50/50">
                <td colSpan={dealsWithAnalyses.length + 1} className="px-4 py-2 text-xs font-semibold text-gray-600 uppercase">
                  Year 1 metrics
                </td>
              </tr>
              <tr className="bg-gray-50">
                <td className="px-4 py-2 text-xs font-medium text-gray-500 uppercase">Cap Rate</td>
                {dealsWithAnalyses.map(({ deal, latestAnalysis }) => (
                  <td key={deal.id} className="px-4 py-2 text-sm">
                    {latestAnalysis ? (
                      <span className={metricClass(latestAnalysis.outputs.capRate, (v) => v > 8, (v) => v > 5)}>
                        {latestAnalysis.outputs.capRate.toFixed(1)}%
                      </span>
                    ) : '—'}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="px-4 py-2 text-xs font-medium text-gray-500 uppercase">Cash Flow (annual)</td>
                {dealsWithAnalyses.map(({ deal, latestAnalysis }) => (
                  <td key={deal.id} className="px-4 py-2 text-sm">
                    {latestAnalysis ? (
                      <span className={metricClass(latestAnalysis.outputs.cashFlowAnnual, (v) => v > 0, () => false)}>
                        {formatCurrency(latestAnalysis.outputs.cashFlowAnnual)}/yr
                      </span>
                    ) : '—'}
                  </td>
                ))}
              </tr>
              <tr className="bg-gray-50">
                <td className="px-4 py-2 text-xs font-medium text-gray-500 uppercase">Cash-on-Cash</td>
                {dealsWithAnalyses.map(({ deal, latestAnalysis }) => (
                  <td key={deal.id} className="px-4 py-2 text-sm">
                    {latestAnalysis ? (
                      <span className={metricClass(latestAnalysis.outputs.cashOnCash, (v) => v > 10, (v) => v > 5)}>
                        {latestAnalysis.outputs.cashOnCash.toFixed(1)}%
                      </span>
                    ) : '—'}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="px-4 py-2 text-xs font-medium text-gray-500 uppercase">DSCR</td>
                {dealsWithAnalyses.map(({ deal, latestAnalysis }) => (
                  <td key={deal.id} className="px-4 py-2 text-sm">
                    {latestAnalysis ? (
                      <span className={metricClass(latestAnalysis.outputs.dscr, (v) => v >= 1.25, (v) => v >= 1.0)}>
                        {latestAnalysis.outputs.dscr.toFixed(2)}
                      </span>
                    ) : '—'}
                  </td>
                ))}
              </tr>
              <tr className="bg-gray-50">
                <td className="px-4 py-2 text-xs font-medium text-gray-500 uppercase">All-in cash required</td>
                {dealsWithAnalyses.map(({ deal, latestAnalysis }) => (
                  <td key={deal.id} className="px-4 py-2 text-sm text-gray-900">
                    {latestAnalysis ? formatCurrency(latestAnalysis.outputs.allInCashRequired) : '—'}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="px-4 py-2 text-xs font-medium text-gray-500 uppercase">NOI (annual)</td>
                {dealsWithAnalyses.map(({ deal, latestAnalysis }) => (
                  <td key={deal.id} className="px-4 py-2 text-sm text-gray-900">
                    {latestAnalysis ? formatCurrency(latestAnalysis.outputs.noiAnnual) : '—'}
                  </td>
                ))}
              </tr>
              {/* Holding period */}
              <tr className="bg-indigo-50/50">
                <td colSpan={dealsWithAnalyses.length + 1} className="px-4 py-2 text-xs font-semibold text-gray-600 uppercase">
                  Holding period returns
                </td>
              </tr>
              <tr className="bg-gray-50">
                <td className="px-4 py-2 text-xs font-medium text-gray-500 uppercase">IRR</td>
                {dealsWithAnalyses.map(({ deal, latestAnalysis }) => (
                  <td key={deal.id} className="px-4 py-2 text-sm">
                    {latestAnalysis?.holdingPeriodOutputs ? (
                      <span className={metricClass(latestAnalysis.holdingPeriodOutputs.irr, (v) => v > 15, (v) => v > 10)}>
                        {latestAnalysis.holdingPeriodOutputs.irr.toFixed(1)}%
                      </span>
                    ) : '—'}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="px-4 py-2 text-xs font-medium text-gray-500 uppercase">Equity Multiple</td>
                {dealsWithAnalyses.map(({ deal, latestAnalysis }) => (
                  <td key={deal.id} className="px-4 py-2 text-sm">
                    {latestAnalysis?.holdingPeriodOutputs ? (
                      <span className={metricClass(latestAnalysis.holdingPeriodOutputs.equityMultiple, (v) => v >= 2, (v) => v >= 1.5)}>
                        {latestAnalysis.holdingPeriodOutputs.equityMultiple.toFixed(2)}x
                      </span>
                    ) : '—'}
                  </td>
                ))}
              </tr>
              <tr className="bg-gray-50">
                <td className="px-4 py-2 text-xs font-medium text-gray-500 uppercase">Total Profit</td>
                {dealsWithAnalyses.map(({ deal, latestAnalysis }) => (
                  <td key={deal.id} className="px-4 py-2 text-sm">
                    {latestAnalysis?.holdingPeriodOutputs ? (
                      <span className={latestAnalysis.holdingPeriodOutputs.exitScenario.totalProfit > 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                        {formatCurrency(latestAnalysis.holdingPeriodOutputs.exitScenario.totalProfit)}
                      </span>
                    ) : '—'}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="px-4 py-2 text-xs font-medium text-gray-500 uppercase">Total ROI</td>
                {dealsWithAnalyses.map(({ deal, latestAnalysis }) => (
                  <td key={deal.id} className="px-4 py-2 text-sm">
                    {latestAnalysis?.holdingPeriodOutputs ? (
                      <span className={metricClass(latestAnalysis.holdingPeriodOutputs.exitScenario.totalROI, (v) => v > 15, (v) => v > 10)}>
                        {latestAnalysis.holdingPeriodOutputs.exitScenario.totalROI.toFixed(1)}%
                      </span>
                    ) : '—'}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default function ComparePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    }>
      <CompareContent />
    </Suspense>
  )
}
