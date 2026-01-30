'use client'

import { useEffect, useState, useMemo, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Deal, ImportStatus, PurchaseType, Analysis } from '@/lib/types'
import { useAuth } from '@/components/AuthProvider'

const statusColors: Record<ImportStatus, string> = {
  success: 'bg-green-100 text-green-800',
  partial: 'bg-yellow-100 text-yellow-800',
  fail: 'bg-red-100 text-red-800',
  manual: 'bg-blue-100 text-blue-800',
}

const statusLabels: Record<ImportStatus, string> = {
  success: 'Success',
  partial: 'Partial',
  fail: 'Failed',
  manual: 'Manual',
}

const purchaseTypeLabels: Record<PurchaseType, string> = {
  primary_residence: 'Primary Residence',
  investment_property: 'Investment Property',
  house_hack: 'House Hack',
  vacation_home: 'Vacation Home',
  other: 'Other',
}

type SortOption = 
  | 'date_desc' | 'date_asc' 
  | 'price_desc' | 'price_asc' 
  | 'address_asc' 
  | 'cap_rate_desc' | 'cash_flow_desc' | 'coc_desc'
  | 'irr_desc' | 'equity_multiple_desc' | 'total_roi_desc' | 'total_profit_desc'

const sortLabels: Record<SortOption, string> = {
  date_desc: 'Newest First',
  date_asc: 'Oldest First',
  price_desc: 'Price: High to Low',
  price_asc: 'Price: Low to High',
  address_asc: 'Address: A to Z',
  cap_rate_desc: 'Cap Rate: High to Low',
  cash_flow_desc: 'Cash Flow: High to Low',
  coc_desc: 'Cash-on-Cash: High to Low',
  irr_desc: 'IRR: High to Low',
  equity_multiple_desc: 'Equity Multiple: High to Low',
  total_roi_desc: 'Total ROI: High to Low',
  total_profit_desc: 'Total Profit: High to Low',
}

interface DealWithAnalysis extends Deal {
  latestAnalysis?: Analysis
}

function DashboardContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, profile, signOut, loading: authLoading } = useAuth()
  const [deals, setDeals] = useState<DealWithAnalysis[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<SortOption>('date_desc')
  const [filterPurchaseType, setFilterPurchaseType] = useState<PurchaseType | 'all'>('all')
  const [filterImportStatus, setFilterImportStatus] = useState<ImportStatus | 'all'>('all')
  const [showUpgradeSuccess, setShowUpgradeSuccess] = useState(false)

  useEffect(() => {
    if (searchParams.get('upgraded') === 'true') {
      setShowUpgradeSuccess(true)
      // Clear the URL param
      router.replace('/dashboard')
    }
  }, [searchParams, router])

  useEffect(() => {
    fetchDeals()
  }, [])

  const fetchDeals = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/deals')
      const data = await res.json()
      const rawDeals: unknown[] = data.deals || []
      const dealsData: DealWithAnalysis[] = rawDeals.filter(
        (d): d is DealWithAnalysis => d != null && typeof (d as Deal)?.id === 'string'
      )

      // Fetch latest analysis for each deal
      const dealsWithAnalyses = await Promise.all(
        dealsData.map(async (deal) => {
          try {
            const analysisRes = await fetch(`/api/deals/${deal.id}/analyses`)
            if (analysisRes.ok) {
              const analysisData = await analysisRes.json()
              if (analysisData.analyses && analysisData.analyses.length > 0) {
                // Get the most recent analysis
                const sorted = analysisData.analyses.sort(
                  (a: Analysis, b: Analysis) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                )
                return { ...deal, latestAnalysis: sorted[0] }
              }
            }
          } catch (e) {
            // Ignore analysis fetch errors
          }
          return deal
        })
      )
      
      setDeals(dealsWithAnalyses)
    } catch (error) {
      console.error('Error fetching deals:', error)
    } finally {
      setLoading(false)
    }
  }

  // Filter and sort deals
  const filteredAndSortedDeals = useMemo(() => {
    let result = [...deals]
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(deal => 
        deal.address?.toLowerCase().includes(query) ||
        deal.zillowUrl?.toLowerCase().includes(query) ||
        deal.city?.toLowerCase().includes(query) ||
        deal.state?.toLowerCase().includes(query)
      )
    }
    
    // Apply purchase type filter
    if (filterPurchaseType !== 'all') {
      result = result.filter(deal => deal.purchaseType === filterPurchaseType)
    }
    
    // Apply import status filter
    if (filterImportStatus !== 'all') {
      result = result.filter(deal => deal.importStatus === filterImportStatus)
    }
    
    // Apply sorting
    result.sort((a, b) => {
      switch (sortBy) {
        case 'date_desc':
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        case 'date_asc':
          return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
        case 'price_desc':
          return (b.listPrice || 0) - (a.listPrice || 0)
        case 'price_asc':
          return (a.listPrice || 0) - (b.listPrice || 0)
        case 'address_asc':
          return (a.address || '').localeCompare(b.address || '')
        case 'cap_rate_desc':
          const aCapRate = a.latestAnalysis?.outputs?.capRate ?? -Infinity
          const bCapRate = b.latestAnalysis?.outputs?.capRate ?? -Infinity
          return bCapRate - aCapRate
        case 'cash_flow_desc':
          const aCashFlow = a.latestAnalysis?.outputs?.cashFlowAnnual ?? -Infinity
          const bCashFlow = b.latestAnalysis?.outputs?.cashFlowAnnual ?? -Infinity
          return bCashFlow - aCashFlow
        case 'coc_desc':
          const aCoc = a.latestAnalysis?.outputs?.cashOnCash ?? -Infinity
          const bCoc = b.latestAnalysis?.outputs?.cashOnCash ?? -Infinity
          return bCoc - aCoc
        case 'irr_desc':
          const aIrr = a.latestAnalysis?.holdingPeriodOutputs?.irr ?? -Infinity
          const bIrr = b.latestAnalysis?.holdingPeriodOutputs?.irr ?? -Infinity
          return bIrr - aIrr
        case 'equity_multiple_desc':
          const aEm = a.latestAnalysis?.holdingPeriodOutputs?.equityMultiple ?? -Infinity
          const bEm = b.latestAnalysis?.holdingPeriodOutputs?.equityMultiple ?? -Infinity
          return bEm - aEm
        case 'total_roi_desc':
          const aRoi = a.latestAnalysis?.holdingPeriodOutputs?.exitScenario?.totalROI ?? -Infinity
          const bRoi = b.latestAnalysis?.holdingPeriodOutputs?.exitScenario?.totalROI ?? -Infinity
          return bRoi - aRoi
        case 'total_profit_desc':
          const aProfit = a.latestAnalysis?.holdingPeriodOutputs?.exitScenario?.totalProfit ?? -Infinity
          const bProfit = b.latestAnalysis?.holdingPeriodOutputs?.exitScenario?.totalProfit ?? -Infinity
          return bProfit - aProfit
        default:
          return 0
      }
    })
    
    return result
  }, [deals, searchQuery, filterPurchaseType, filterImportStatus, sortBy])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const formatCurrency = (value: number | null) => {
    if (value === null) return '—'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const handleEdit = (e: React.MouseEvent, dealId: string) => {
    e.preventDefault()
    e.stopPropagation()
    router.push(`/deals/${dealId}`)
  }

  const handleDeleteClick = (e: React.MouseEvent, dealId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setShowDeleteConfirm(dealId)
  }

  const handleDeleteConfirm = async (dealId: string) => {
    setDeletingId(dealId)
    try {
      const res = await fetch(`/api/deals/${dealId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        throw new Error('Failed to delete deal')
      }

      // Remove from local state
      setDeals(prevDeals => prevDeals.filter(d => d.id !== dealId))
      setShowDeleteConfirm(null)
    } catch (error) {
      console.error('Error deleting deal:', error)
      alert('Failed to delete deal. Please try again.')
    } finally {
      setDeletingId(null)
    }
  }

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(null)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation Bar */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-gray-900">DealMetrics</h1>
              {profile && (
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  profile.subscription_tier === 'pro' 
                    ? 'bg-blue-100 text-blue-800' 
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {profile.subscription_tier === 'pro' ? 'Pro' : 'Free'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4">
              {profile && profile.subscription_tier === 'free' && (
                <div className="hidden sm:flex items-center gap-2 text-sm text-gray-600">
                  <span>
                    <strong>{2 - (profile.imports_this_month || 0)}</strong> imports remaining
                  </span>
                  <Link
                    href="/pricing"
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Upgrade
                  </Link>
                </div>
              )}
              {user && (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 hidden sm:inline">
                    {user.email}
                  </span>
                  <button
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Upgrade Success Banner */}
        {showUpgradeSuccess && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="font-medium text-green-800">Welcome to Pro!</p>
                <p className="text-sm text-green-600">You now have unlimited extension imports.</p>
              </div>
            </div>
            <button
              onClick={() => setShowUpgradeSuccess(false)}
              className="text-green-600 hover:text-green-800"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Free tier import limit warning */}
        {profile && profile.subscription_tier === 'free' && (profile.imports_this_month || 0) >= 2 && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="flex-1">
                <p className="font-medium text-amber-800">Extension import limit reached</p>
                <p className="text-sm text-amber-600">
                  You&apos;ve used all 2 of your monthly extension imports. 
                  You can still create deals manually, or upgrade to Pro for unlimited imports.
                </p>
              </div>
              <Link
                href="/pricing"
                className="px-4 py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 transition-colors whitespace-nowrap"
              >
                Upgrade to Pro
              </Link>
            </div>
          </div>
        )}

        {/* Chrome Extension Download Card */}
        <div className="mb-6 p-5 bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl text-white">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-white/20 rounded-lg">
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold">Get the DealMetrics Chrome Extension</h3>
                <p className="text-blue-100 text-sm mt-1">
                  Import listings directly from real estate sites with one click. 
                  {profile?.subscription_tier === 'free' ? ' Free users get 2 imports/month.' : ' Unlimited imports with Pro!'}
                </p>
              </div>
            </div>
            <a
              href="https://chrome.google.com/webstore/detail/dealmetrics/YOUR_EXTENSION_ID"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-5 py-2.5 bg-white text-blue-700 rounded-lg font-medium hover:bg-blue-50 transition-colors whitespace-nowrap"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C8.21 0 4.831 1.757 2.632 4.501l3.953 6.848A5.454 5.454 0 0 1 12 6.545h10.691A12 12 0 0 0 12 0zM1.931 5.47A11.943 11.943 0 0 0 0 12c0 6.012 4.42 10.991 10.189 11.864l3.953-6.847a5.45 5.45 0 0 1-6.865-2.29L1.931 5.47zm13.713 7.254l3.954 6.848A11.955 11.955 0 0 0 24 12c0-.746-.068-1.477-.198-2.182H12a5.454 5.454 0 0 1 3.644 2.906zM12 8.009a3.99 3.99 0 1 0 0 7.982 3.99 3.99 0 0 0 0-7.982z"/>
              </svg>
              Download Free Extension
            </a>
          </div>
        </div>

        <div className="mb-8">
          <p className="text-gray-600">Analyze your real estate deals</p>
        </div>

        {/* Search and Create */}
        <div className="mb-4 flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by address, city, or state..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
            />
          </div>
          <Link
            href="/deals/new"
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium whitespace-nowrap text-center"
          >
            Create Manual Deal
          </Link>
        </div>

        {/* Filters and Sorting */}
        <div className="mb-6 flex flex-wrap gap-3 items-center bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Sort:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black bg-white"
            >
              <optgroup label="Basic">
                <option value="date_desc">Newest First</option>
                <option value="date_asc">Oldest First</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="address_asc">Address: A to Z</option>
              </optgroup>
              <optgroup label="Year 1 Metrics">
                <option value="cap_rate_desc">Cap Rate: High to Low</option>
                <option value="cash_flow_desc">Cash Flow: High to Low</option>
                <option value="coc_desc">Cash-on-Cash: High to Low</option>
              </optgroup>
              <optgroup label="Holding Period Returns">
                <option value="irr_desc">IRR: High to Low</option>
                <option value="equity_multiple_desc">Equity Multiple: High to Low</option>
                <option value="total_roi_desc">Total ROI: High to Low</option>
                <option value="total_profit_desc">Total Profit: High to Low</option>
              </optgroup>
            </select>
          </div>
          
          <div className="w-px h-6 bg-gray-300 hidden sm:block" />
          
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Type:</label>
            <select
              value={filterPurchaseType}
              onChange={(e) => setFilterPurchaseType(e.target.value as PurchaseType | 'all')}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black bg-white"
            >
              <option value="all">All Types</option>
              {Object.entries(purchaseTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          
          <div className="w-px h-6 bg-gray-300 hidden sm:block" />
          
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Import:</label>
            <select
              value={filterImportStatus}
              onChange={(e) => setFilterImportStatus(e.target.value as ImportStatus | 'all')}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black bg-white"
            >
              <option value="all">All</option>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          
          {(filterPurchaseType !== 'all' || filterImportStatus !== 'all' || searchQuery) && (
            <>
              <div className="w-px h-6 bg-gray-300 hidden sm:block" />
              <button
                onClick={() => {
                  setFilterPurchaseType('all')
                  setFilterImportStatus('all')
                  setSearchQuery('')
                }}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Clear Filters
              </button>
            </>
          )}
          
          <div className="ml-auto text-sm text-gray-500">
            {filteredAndSortedDeals.length} deal{filteredAndSortedDeals.length !== 1 ? 's' : ''}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Loading deals...</p>
          </div>
        ) : filteredAndSortedDeals.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <p className="text-gray-500 mb-4">
              {searchQuery || filterPurchaseType !== 'all' || filterImportStatus !== 'all' 
                ? 'No deals found matching your filters.' 
                : 'No deals yet.'}
            </p>
            {!searchQuery && filterPurchaseType === 'all' && filterImportStatus === 'all' && (
              <Link
                href="/deals/new"
                className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create your first deal
              </Link>
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredAndSortedDeals.map((deal) => (
              <div
                key={deal.id}
                className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <Link
                    href={`/deals/${deal.id}`}
                    className="flex-1"
                  >
                    <div className="flex items-start gap-3 mb-2 flex-wrap">
                      <h2 className="text-xl font-semibold text-gray-900">
                        {deal.address || 'Unknown address'}
                      </h2>
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[deal.importStatus]}`}
                      >
                        {statusLabels[deal.importStatus]}
                      </span>
                      {deal.purchaseType && (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                          {purchaseTypeLabels[deal.purchaseType]}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-600 mt-2">
                      <span>List Price: {formatCurrency(deal.listPrice)}</span>
                      {deal.propertyType && (
                        <span>Type: {deal.propertyType}</span>
                      )}
                      {deal.beds !== null && deal.baths !== null && (
                        <span>
                          {deal.beds} bed / {deal.baths} bath
                        </span>
                      )}
                      {deal.sqft !== null && (
                        <span>{deal.sqft.toLocaleString()} sqft</span>
                      )}
                    </div>
                    
                    {/* Analysis Metrics */}
                    {deal.latestAnalysis && (
                      <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t border-gray-100">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium text-gray-500 uppercase">Cap Rate</span>
                          <span className={`text-sm font-semibold ${
                            deal.latestAnalysis.outputs.capRate > 8 ? 'text-green-600' :
                            deal.latestAnalysis.outputs.capRate > 5 ? 'text-yellow-600' : 'text-gray-700'
                          }`}>
                            {deal.latestAnalysis.outputs.capRate.toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium text-gray-500 uppercase">Cash Flow</span>
                          <span className={`text-sm font-semibold ${
                            deal.latestAnalysis.outputs.cashFlowAnnual > 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {formatCurrency(deal.latestAnalysis.outputs.cashFlowAnnual)}/yr
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium text-gray-500 uppercase">CoC</span>
                          <span className={`text-sm font-semibold ${
                            deal.latestAnalysis.outputs.cashOnCash > 10 ? 'text-green-600' :
                            deal.latestAnalysis.outputs.cashOnCash > 5 ? 'text-yellow-600' : 'text-gray-700'
                          }`}>
                            {deal.latestAnalysis.outputs.cashOnCash.toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium text-gray-500 uppercase">DSCR</span>
                          <span className={`text-sm font-semibold ${
                            deal.latestAnalysis.outputs.dscr >= 1.25 ? 'text-green-600' :
                            deal.latestAnalysis.outputs.dscr >= 1.0 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {deal.latestAnalysis.outputs.dscr.toFixed(2)}
                          </span>
                        </div>
                        {/* Holding Period Metrics */}
                        {deal.latestAnalysis.holdingPeriodOutputs && (
                          <>
                            <div className="w-px h-4 bg-gray-300 self-center" />
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-medium text-indigo-500 uppercase">IRR</span>
                              <span className={`text-sm font-semibold ${
                                deal.latestAnalysis.holdingPeriodOutputs.irr > 15 ? 'text-green-600' :
                                deal.latestAnalysis.holdingPeriodOutputs.irr > 10 ? 'text-yellow-600' : 'text-gray-700'
                              }`}>
                                {deal.latestAnalysis.holdingPeriodOutputs.irr.toFixed(1)}%
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-medium text-indigo-500 uppercase">Equity Mult</span>
                              <span className={`text-sm font-semibold ${
                                deal.latestAnalysis.holdingPeriodOutputs.equityMultiple >= 2 ? 'text-green-600' :
                                deal.latestAnalysis.holdingPeriodOutputs.equityMultiple >= 1.5 ? 'text-yellow-600' : 'text-gray-700'
                              }`}>
                                {deal.latestAnalysis.holdingPeriodOutputs.equityMultiple.toFixed(2)}x
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-medium text-indigo-500 uppercase">Total Profit</span>
                              <span className={`text-sm font-semibold ${
                                deal.latestAnalysis.holdingPeriodOutputs.exitScenario.totalProfit > 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {formatCurrency(deal.latestAnalysis.holdingPeriodOutputs.exitScenario.totalProfit)}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                    {!deal.latestAnalysis && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <span className="text-xs text-gray-400 italic">No analysis run yet</span>
                      </div>
                    )}
                  </Link>
                  <div className="flex items-center gap-3 lg:flex-col lg:items-end">
                    <div className="text-sm text-gray-500 mb-2">
                      Updated {formatDate(deal.updatedAt)}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => handleEdit(e, deal.id)}
                        className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={(e) => handleDeleteClick(e, deal.id)}
                        disabled={deletingId === deal.id}
                        className="px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {deletingId === deal.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Deal</h3>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete this deal? This action cannot be undone.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={handleDeleteCancel}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteConfirm(showDeleteConfirm)}
                  disabled={deletingId === showDeleteConfirm}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deletingId === showDeleteConfirm ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-500">Loading...</p></div>}>
      <DashboardContent />
    </Suspense>
  )
}
