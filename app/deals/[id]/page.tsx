'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { Deal, Analysis, ImportStatus, HoldingPeriodOutputs, PrimaryResidenceOutputs, PrimaryResidenceHoldingPeriodOutputs } from '@/lib/types'

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

export default function DealDetailPage() {
  const router = useRouter()
  const params = useParams()
  const dealId = params.id as string
  
  const [deal, setDeal] = useState<Deal | null>(null)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [holdingPeriodAnalysis, setHoldingPeriodAnalysis] = useState<HoldingPeriodOutputs | null>(null)
  const [primaryResidenceOutputs, setPrimaryResidenceOutputs] = useState<PrimaryResidenceOutputs | null>(null)
  const [primaryResidenceHoldingPeriod, setPrimaryResidenceHoldingPeriod] = useState<PrimaryResidenceHoldingPeriodOutputs | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [showCashFlowSchedule, setShowCashFlowSchedule] = useState(false)
  const [showAdvancedMetrics, setShowAdvancedMetrics] = useState(false)
  
  const fieldRefs = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => {
    fetchDeal()
    fetchLatestAnalysis()
  }, [dealId])

  const fetchDeal = async () => {
    try {
      const res = await fetch(`/api/deals/${dealId}`)
      if (!res.ok) {
        if (res.status === 404) {
          router.push('/dashboard')
          return
        }
        throw new Error('Failed to fetch deal')
      }
      const data = await res.json()
      setDeal(data.deal)
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const fetchLatestAnalysis = async () => {
    try {
      const res = await fetch(`/api/deals/${dealId}/analyses`)
      if (res.ok) {
        const data = await res.json()
        if (data.analyses && data.analyses.length > 0) {
          setAnalysis(data.analyses[0])
        }
      }
    } catch (err) {
      // Analysis fetch is optional
    }
  }

  const handleSave = async (updates: Partial<Deal>) => {
    if (!deal) return
    
    // Don't save if no updates
    if (Object.keys(updates).length === 0) return
    
    setSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/deals/${dealId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update deal')
      }

      // Don't overwrite local state with server response
      // Local state is already updated optimistically via setDeal in handleInputChange
      // Only update server-generated fields like updatedAt
      const data = await res.json()
      setDeal(prevDeal => prevDeal ? { 
        ...prevDeal, 
        updatedAt: data.deal.updatedAt 
      } : data.deal)
    } catch (err: any) {
      setError(err.message || 'An error occurred')
      // On error, we could optionally revert changes by re-fetching
      // For now, just show the error
    } finally {
      setSaving(false)
    }
  }

  const handleInputChange = (field: keyof Deal, value: string | number | boolean | null) => {
    if (!deal) return
    
    let processedValue: any = value
    if (typeof value === 'string') {
      // For empty strings, set to null
      if (value === '') {
        processedValue = null
      } else {
        // Try to parse as number, but keep as string if it's not a valid number
        const numValue = parseFloat(value)
        processedValue = isNaN(numValue) ? value : numValue
      }
    }
    
    const updates = { [field]: processedValue }
    // Use functional update to avoid stale closure issues when multiple handleInputChange calls happen
    setDeal(prevDeal => prevDeal ? { ...prevDeal, ...updates } : prevDeal)
    
    // Accumulate pending updates instead of replacing them
    if (!(window as any).pendingUpdates) {
      (window as any).pendingUpdates = {}
    }
    (window as any).pendingUpdates[field] = processedValue
    
    clearTimeout((window as any).saveTimeout)
    ;(window as any).saveTimeout = setTimeout(() => {
      const allUpdates = (window as any).pendingUpdates || {}
      ;(window as any).pendingUpdates = {} // Clear pending updates
      handleSave(allUpdates)
    }, 1000)
  }

  const handleAnalyze = async () => {
    if (!deal) return
    
    setAnalyzing(true)
    setError(null)

    try {
      // Validate required fields (varies by purchase type)
      const requiredFields: string[] = [
        'purchasePrice', 'closingCostRate', 'rehabCost', 'downPaymentPct',
        'interestRate', 'termYears', 'taxesAnnual', 'insuranceAnnual',
        'maintenanceRate', 'capexRate'
      ]
      
      // Add rental-related fields only if not primary residence
      if (deal.purchaseType !== 'primary_residence') {
        requiredFields.push('rentMonthly', 'vacancyRate', 'managementRate')
      } else {
        // For primary residence, ensure rent is 0 and vacancy/management are 0
        if (deal.rentMonthly !== 0 && deal.rentMonthly !== null) {
          setError('Rental income must be $0 for primary residences')
          setAnalyzing(false)
          return
        }
      }
      
      const missing = requiredFields.filter(field => {
        const value = deal[field as keyof Deal]
        return value === null || value === undefined || value === ''
      })
      
      if (missing.length > 0) {
        setError(`Please fill in: ${missing.join(', ')}`)
        setAnalyzing(false)
        return
      }

      const inputs = {
        purchasePrice: deal.purchasePrice!,
        closingCostRate: deal.closingCostRate!,
        rehabCost: deal.rehabCost || 0,
        downPaymentPct: deal.downPaymentPct!,
        interestRate: deal.interestRate!,
        termYears: deal.termYears!,
        pmiEnabled: deal.pmiEnabled || false,
        pmiMonthly: deal.pmiMonthly || 0,
        taxesAnnual: deal.taxesAnnual!,
        insuranceAnnual: deal.insuranceAnnual!,
        hoaMonthly: deal.hoaMonthly || 0,
        utilitiesMonthly: deal.utilitiesMonthly || 0,
        rentMonthly: deal.purchaseType === 'primary_residence' ? 0 : (deal.rentMonthly || 0),
        otherIncomeMonthly: deal.otherIncomeMonthly || 0,
        vacancyRate: deal.purchaseType === 'primary_residence' ? 0 : (deal.vacancyRate || 0),
        maintenanceRate: deal.maintenanceRate!,
        capexRate: deal.capexRate!,
        managementRate: deal.purchaseType === 'primary_residence' ? 0 : (deal.managementRate || 0),
        // Holding period inputs (for all property types)
        holdingPeriodYears: deal.holdingPeriodYears || 10,
        appreciationRate: deal.appreciationRate ?? 3,
        rentGrowthRate: deal.rentGrowthRate ?? 2,
        expenseGrowthRate: deal.expenseGrowthRate ?? 2,
        sellingCostRate: deal.sellingCostRate ?? 6,
      }

      const res = await fetch(`/api/deals/${dealId}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inputs),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to analyze deal')
      }

      const data = await res.json()
      setAnalysis(data.analysis)
      if (data.holdingPeriodAnalysis) {
        setHoldingPeriodAnalysis(data.holdingPeriodAnalysis)
      }
      if (data.primaryResidenceOutputs) {
        setPrimaryResidenceOutputs(data.primaryResidenceOutputs)
      }
      if (data.primaryResidenceHoldingPeriod) {
        setPrimaryResidenceHoldingPeriod(data.primaryResidenceHoldingPeriod)
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleShare = async () => {
    try {
      const res = await fetch(`/api/deals/${dealId}/share`, {
        method: 'POST',
      })

      if (!res.ok) {
        throw new Error('Failed to create share link')
      }

      const data = await res.json()
      setShareUrl(data.url)
      
      // Copy to clipboard
      await navigator.clipboard.writeText(data.url)
      alert('Share link copied to clipboard!')
    } catch (err: any) {
      setError(err.message || 'Failed to create share link')
    }
  }

  const scrollToField = (fieldName: string) => {
    const field = fieldRefs.current[fieldName]
    if (field) {
      field.scrollIntoView({ behavior: 'smooth', block: 'center' })
      field.focus()
    }
  }

  const getMissingFields = (): string[] => {
    if (!deal) return []
    const required: string[] = ['purchasePrice', 'taxesAnnual', 'insuranceAnnual', 'interestRate', 'downPaymentPct']
    
    // Only require rentMonthly if not primary residence
    if (deal.purchaseType !== 'primary_residence') {
      required.push('rentMonthly')
    }
    
    return required.filter(field => {
      const value = deal[field as keyof Deal]
      return value === null || value === undefined || value === ''
    })
  }

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return ''
    return value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  }

  const parseCurrency = (value: string): number | null => {
    const cleaned = value.replace(/[^0-9.]/g, '')
    if (!cleaned) return null
    return parseFloat(cleaned) || null
  }

  const formatPercent = (value: number | null) => {
    if (value === null || value === undefined) return ''
    return value.toString()
  }

  const parsePercent = (value: string | number): number | null => {
    if (typeof value === 'number') return value
    if (value === '' || value === null || value === undefined) return null
    const cleaned = value.toString().replace(/[^0-9.]/g, '')
    if (!cleaned) return null
    const parsed = parseFloat(cleaned)
    return isNaN(parsed) ? null : parsed
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading deal...</p>
      </div>
    )
  }

  if (!deal) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Deal not found</p>
          <Link href="/dashboard" className="text-blue-600 hover:text-blue-700">
            Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  const missingFields = getMissingFields()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link href="/dashboard" className="text-blue-600 hover:text-blue-700 font-medium mb-4 inline-block">
            ← Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Deal Details</h1>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {saving && (
          <div className="mb-6 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg">
            Saving...
          </div>
        )}

        {/* Missing Fields Callout */}
        {missingFields.length > 0 && (
          <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="font-semibold text-yellow-900 mb-2">Missing Required Fields</h3>
            <p className="text-sm text-yellow-800 mb-3">
              Please fill in these fields to run analysis:
            </p>
            <div className="flex flex-wrap gap-2">
              {missingFields.map(field => (
                <button
                  key={field}
                  onClick={() => scrollToField(field)}
                  className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded text-sm hover:bg-yellow-200"
                >
                  {field}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Deal Summary */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Deal Summary</h2>
          
          <div className="space-y-4">
            {deal.zillowUrl && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Listing URL</label>
                <a href={deal.zillowUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 break-all">
                  {deal.zillowUrl}
                </a>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <label className="block text-sm font-medium text-gray-700">Address</label>
                  {deal.importedFields?.includes('address') && deal.fieldConfidences?.['address'] && (
                    <span className="text-xs text-gray-500">
                      ({Math.round(deal.fieldConfidences['address'] * 100)}% confidence)
                    </span>
                  )}
                  {deal.assumedFields?.includes('address') && (
                    <span className="px-2 py-0.5 text-xs font-medium rounded bg-yellow-100 text-yellow-800">
                      Assumed
                    </span>
                  )}
                </div>
                <input
                  ref={el => { fieldRefs.current['address'] = el }}
                  type="text"
                  value={deal.address || ''}
                  onChange={(e) => handleInputChange('address', e.target.value || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
                />
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <label className="block text-sm font-medium text-gray-700">Property Type</label>
                  {deal.importedFields?.includes('propertyType') && deal.fieldConfidences?.['propertyType'] && (
                    <span className="text-xs text-gray-500">
                      ({Math.round(deal.fieldConfidences['propertyType'] * 100)}% confidence)
                    </span>
                  )}
                  {deal.assumedFields?.includes('propertyType') && (
                    <span className="px-2 py-0.5 text-xs font-medium rounded bg-yellow-100 text-yellow-800">
                      Assumed
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  value={deal.propertyType || ''}
                  onChange={(e) => handleInputChange('propertyType', e.target.value || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
                />
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <label className="block text-sm font-medium text-gray-700">Beds / Baths</label>
                  {(deal.importedFields?.includes('beds') || deal.importedFields?.includes('baths')) && (
                    <span className="text-xs text-gray-500">
                      {deal.fieldConfidences?.['beds'] && `(${Math.round(deal.fieldConfidences['beds'] * 100)}%)`}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={deal.beds ?? ''}
                    onChange={(e) => handleInputChange('beds', e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="Beds"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
                  />
                  <input
                    type="number"
                    value={deal.baths ?? ''}
                    onChange={(e) => handleInputChange('baths', e.target.value ? parseFloat(e.target.value) : null)}
                    placeholder="Baths"
                    step="0.5"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <label className="block text-sm font-medium text-gray-700">Square Feet</label>
                  {deal.importedFields?.includes('sqft') && deal.fieldConfidences?.['sqft'] && (
                    <span className="text-xs text-gray-500">
                      ({Math.round(deal.fieldConfidences['sqft'] * 100)}% confidence)
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  value={deal.sqft ?? ''}
                  onChange={(e) => handleInputChange('sqft', e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
                />
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <label className="block text-sm font-medium text-gray-700">Year Built</label>
                  {deal.importedFields?.includes('yearBuilt') && deal.fieldConfidences?.['yearBuilt'] && (
                    <span className="text-xs text-gray-500">
                      ({Math.round(deal.fieldConfidences['yearBuilt'] * 100)}% confidence)
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  value={deal.yearBuilt ?? ''}
                  onChange={(e) => handleInputChange('yearBuilt', e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="e.g. 1985"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <label className="block text-sm font-medium text-gray-700">List Price</label>
                {deal.importedFields?.includes('listPrice') && deal.fieldConfidences?.['listPrice'] && (
                  <span className="text-xs text-gray-500">
                    ({Math.round(deal.fieldConfidences['listPrice'] * 100)}% confidence)
                  </span>
                )}
              </div>
              <div className="text-lg font-semibold text-gray-900">
                {formatCurrency(deal.listPrice) || '—'}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Import Status</label>
              <span className={`inline-block px-3 py-1 text-sm font-medium rounded-full ${statusColors[deal.importStatus]}`}>
                {statusLabels[deal.importStatus]}
              </span>
            </div>
          </div>
        </div>

        {/* Purchase Inputs */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Purchase</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Type *</label>
              <select
                value={deal.purchaseType || ''}
                onChange={(e) => {
                  const purchaseType = e.target.value as any
                  const oldPurchaseType = deal.purchaseType
                  handleInputChange('purchaseType', purchaseType || null)
                  
                  // If Primary Residence, set appropriate defaults
                  if (purchaseType === 'primary_residence') {
                    handleInputChange('rentMonthly', 0)
                    handleInputChange('vacancyRate', 0)
                    handleInputChange('managementRate', 0)
                    // Set lower maintenance/capex rates for primary residence (0.5% each = 1% total annually)
                    // This is the industry standard for homeowner maintenance reserves
                    handleInputChange('maintenanceRate', 0.5)
                    handleInputChange('capexRate', 0.5)
                    // Clear multi-unit fields
                    handleInputChange('numberOfUnits', null)
                    handleInputChange('rentPerUnit', null)
                    handleInputChange('vacancyRatePerUnit', null)
                  }
                  
                  // If switching away from house_hack/investment_property, clear multi-unit fields
                  if ((oldPurchaseType === 'house_hack' || oldPurchaseType === 'investment_property') &&
                      purchaseType !== 'house_hack' && purchaseType !== 'investment_property') {
                    handleInputChange('numberOfUnits', null)
                    handleInputChange('rentPerUnit', null)
                    handleInputChange('vacancyRatePerUnit', null)
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
              >
                <option value="">Select...</option>
                <option value="primary_residence">Primary Residence</option>
                <option value="investment_property">Investment Property</option>
                <option value="house_hack">House Hack (Multi-Family)</option>
                <option value="vacation_home">Vacation Home</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <label className="block text-sm font-medium text-gray-700">Purchase Price *</label>
                {deal.importedFields?.includes('listPrice') && deal.fieldConfidences?.['listPrice'] && (
                  <span className="text-xs text-gray-500">
                    ({Math.round(deal.fieldConfidences['listPrice'] * 100)}% confidence)
                  </span>
                )}
                {deal.assumedFields?.includes('purchasePrice') && (
                  <span className="px-2 py-0.5 text-xs font-medium rounded bg-yellow-100 text-yellow-800">
                    Assumed
                  </span>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-500">$</span>
                <input
                  ref={el => { fieldRefs.current['purchasePrice'] = el }}
                  type="text"
                  value={formatCurrency(deal.purchasePrice)}
                  onChange={(e) => handleInputChange('purchasePrice', parseCurrency(e.target.value))}
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <label className="block text-sm font-medium text-gray-700">Closing Cost Rate (%)</label>
                {deal.assumedFields?.includes('closingCostRate') && (
                  <span className="px-2 py-0.5 text-xs font-medium rounded bg-yellow-100 text-yellow-800">
                    Assumed
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={deal.closingCostRate ?? ''}
                  onChange={(e) => handleInputChange('closingCostRate', parsePercent(e.target.value))}
                  className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
                />
                <span className="absolute right-3 top-2 text-gray-500">%</span>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <label className="block text-sm font-medium text-gray-700">Rehab Cost</label>
                {deal.assumedFields?.includes('rehabCost') && (
                  <span className="px-2 py-0.5 text-xs font-medium rounded bg-yellow-100 text-yellow-800">
                    Assumed
                  </span>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-500">$</span>
                <input
                  type="text"
                  value={formatCurrency(deal.rehabCost)}
                  onChange={(e) => handleInputChange('rehabCost', parseCurrency(e.target.value))}
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Loan Inputs */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Loan</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <label className="block text-sm font-medium text-gray-700">Down Payment (%) *</label>
                {deal.assumedFields?.includes('downPaymentPct') && (
                  <span className="px-2 py-0.5 text-xs font-medium rounded bg-yellow-100 text-yellow-800">
                    Assumed
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  ref={el => { fieldRefs.current['downPaymentPct'] = el }}
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={deal.downPaymentPct ?? ''}
                  onChange={(e) => handleInputChange('downPaymentPct', parsePercent(e.target.value))}
                  className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
                />
                <span className="absolute right-3 top-2 text-gray-500">%</span>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <label className="block text-sm font-medium text-gray-700">Interest Rate (%) *</label>
                {deal.assumedFields?.includes('interestRate') && (
                  <span className="px-2 py-0.5 text-xs font-medium rounded bg-yellow-100 text-yellow-800">
                    Assumed
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  ref={el => { fieldRefs.current['interestRate'] = el }}
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={deal.interestRate ?? ''}
                  onChange={(e) => handleInputChange('interestRate', parsePercent(e.target.value))}
                  className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
                />
                <span className="absolute right-3 top-2 text-gray-500">%</span>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <label className="block text-sm font-medium text-gray-700">Term (Years)</label>
                {deal.assumedFields?.includes('termYears') && (
                  <span className="px-2 py-0.5 text-xs font-medium rounded bg-yellow-100 text-yellow-800">
                    Assumed
                  </span>
                )}
              </div>
              <input
                type="number"
                value={deal.termYears ?? ''}
                onChange={(e) => handleInputChange('termYears', e.target.value ? parseInt(e.target.value) : null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PMI Enabled</label>
              <input
                type="checkbox"
                checked={deal.pmiEnabled || false}
                onChange={(e) => handleInputChange('pmiEnabled', e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
            </div>

            {deal.pmiEnabled && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">PMI Monthly</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-500">$</span>
                  <input
                    type="text"
                    value={formatCurrency(deal.pmiMonthly)}
                    onChange={(e) => handleInputChange('pmiMonthly', parseCurrency(e.target.value))}
                    className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Monthly Costs */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Monthly Costs</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <label className="block text-sm font-medium text-gray-700">Taxes (Annual) *</label>
                {deal.assumedFields?.includes('taxesAnnual') && (
                  <span className="px-2 py-0.5 text-xs font-medium rounded bg-yellow-100 text-yellow-800">
                    Assumed
                  </span>
                )}
                {deal.importedFields?.includes('taxesAnnual') && deal.fieldConfidences?.['taxesAnnual'] && (
                  <span className="text-xs text-gray-500">
                    ({Math.round(deal.fieldConfidences['taxesAnnual'] * 100)}% confidence)
                  </span>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-500">$</span>
                <input
                  ref={el => { fieldRefs.current['taxesAnnual'] = el }}
                  type="text"
                  value={formatCurrency(deal.taxesAnnual)}
                  onChange={(e) => handleInputChange('taxesAnnual', parseCurrency(e.target.value))}
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <label className="block text-sm font-medium text-gray-700">Insurance (Annual) *</label>
                {deal.assumedFields?.includes('insuranceAnnual') && (
                  <span className="px-2 py-0.5 text-xs font-medium rounded bg-yellow-100 text-yellow-800">
                    Assumed
                  </span>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-500">$</span>
                <input
                  ref={el => { fieldRefs.current['insuranceAnnual'] = el }}
                  type="text"
                  value={formatCurrency(deal.insuranceAnnual)}
                  onChange={(e) => handleInputChange('insuranceAnnual', parseCurrency(e.target.value))}
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">HOA Monthly</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-500">$</span>
                <input
                  type="text"
                  value={formatCurrency(deal.hoaMonthly)}
                  onChange={(e) => handleInputChange('hoaMonthly', parseCurrency(e.target.value))}
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Utilities</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-500">$</span>
                <input
                  type="text"
                  value={formatCurrency(deal.utilitiesMonthly)}
                  onChange={(e) => handleInputChange('utilitiesMonthly', parseCurrency(e.target.value))}
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Income - Hidden for Primary Residence */}
        {deal.purchaseType !== 'primary_residence' && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Income</h2>
            
            {/* Multi-Family / House Hack: Per-Unit Inputs */}
            {(deal.purchaseType === 'house_hack' || deal.purchaseType === 'investment_property') && (
              <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {deal.purchaseType === 'house_hack' ? 'House Hack Details' : 'Multi-Unit Details'}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {deal.purchaseType === 'house_hack' 
                        ? 'You live in one unit and rent out the rest'
                        : 'All units are rented out (investment property)'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {deal.numberOfUnits && deal.numberOfUnits > (deal.purchaseType === 'house_hack' ? 2 : 1) && (
                      <button
                        type="button"
                        onClick={() => {
                          const currentUnits = deal.numberOfUnits || (deal.purchaseType === 'house_hack' ? 2 : 1)
                          const minUnits = deal.purchaseType === 'house_hack' ? 2 : 1
                          const newUnits = Math.max(minUnits, currentUnits - 1)
                          handleInputChange('numberOfUnits', newUnits)
                          // Auto-calculate total rent based on rent per unit OR derive from current rent
                          const rentPerUnit = deal.rentPerUnit || (deal.rentMonthly && currentUnits > 0 ? Math.round(deal.rentMonthly / (deal.purchaseType === 'house_hack' ? currentUnits - 1 : currentUnits)) : null)
                          if (rentPerUnit) {
                            const rentedUnits = deal.purchaseType === 'house_hack' ? newUnits - 1 : newUnits
                            handleInputChange('rentMonthly', rentPerUnit * rentedUnits)
                            if (!deal.rentPerUnit) {
                              handleInputChange('rentPerUnit', rentPerUnit)
                            }
                          }
                        }}
                        className="px-3 py-1 text-sm font-medium text-red-600 bg-red-100 rounded-lg hover:bg-red-200"
                      >
                        - Remove Unit
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        const currentUnits = deal.numberOfUnits || (deal.purchaseType === 'house_hack' ? 2 : 1)
                        const newUnits = currentUnits + 1
                        handleInputChange('numberOfUnits', newUnits)
                        // Auto-calculate total rent based on rent per unit OR derive from current rent
                        const currentRentedUnits = deal.purchaseType === 'house_hack' ? Math.max(1, currentUnits - 1) : currentUnits
                        const rentPerUnit = deal.rentPerUnit || (deal.rentMonthly && currentRentedUnits > 0 ? Math.round(deal.rentMonthly / currentRentedUnits) : null)
                        if (rentPerUnit) {
                          const rentedUnits = deal.purchaseType === 'house_hack' ? newUnits - 1 : newUnits
                          handleInputChange('rentMonthly', rentPerUnit * rentedUnits)
                          if (!deal.rentPerUnit) {
                            handleInputChange('rentPerUnit', rentPerUnit)
                          }
                        }
                      }}
                      className="px-3 py-1 text-sm font-medium text-blue-600 bg-blue-100 rounded-lg hover:bg-blue-200"
                    >
                      + Add Unit
                    </button>
                  </div>
                </div>

                {/* House Hack Info Banner */}
                {deal.purchaseType === 'house_hack' && (
                  <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-800">
                      <strong>House Hack Strategy:</strong> You occupy 1 unit as your primary residence. 
                      {deal.numberOfUnits && deal.numberOfUnits > 1 && (
                        <> The other {(deal.numberOfUnits || 2) - 1} unit{(deal.numberOfUnits || 2) - 1 > 1 ? 's' : ''} generate rental income to offset your housing costs.</>
                      )}
                    </p>
                  </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {deal.purchaseType === 'house_hack' ? 'Total Units (Including Yours)' : 'Number of Units'}
                    </label>
                    <input
                      type="number"
                      min={deal.purchaseType === 'house_hack' ? 2 : 1}
                      max="20"
                      value={deal.numberOfUnits ?? (deal.purchaseType === 'house_hack' ? 2 : 1)}
                      onChange={(e) => {
                        const minUnits = deal.purchaseType === 'house_hack' ? 2 : 1
                        const oldUnits = deal.numberOfUnits || minUnits
                        const units = Math.max(minUnits, parseInt(e.target.value) || minUnits)
                        handleInputChange('numberOfUnits', units)
                        // Auto-calculate total rent based on rent per unit OR derive from current rent
                        const oldRentedUnits = deal.purchaseType === 'house_hack' ? Math.max(1, oldUnits - 1) : oldUnits
                        const rentPerUnit = deal.rentPerUnit || (deal.rentMonthly && oldRentedUnits > 0 ? Math.round(deal.rentMonthly / oldRentedUnits) : null)
                        if (rentPerUnit) {
                          const rentedUnits = deal.purchaseType === 'house_hack' ? units - 1 : units
                          handleInputChange('rentMonthly', rentPerUnit * rentedUnits)
                          if (!deal.rentPerUnit) {
                            handleInputChange('rentPerUnit', rentPerUnit)
                          }
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {deal.purchaseType === 'house_hack' 
                        ? `${(deal.numberOfUnits || 2) - 1} rented, 1 owner-occupied`
                        : 'All units are rented out'}
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Rent Per Unit (Monthly)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-gray-500">$</span>
                      <input
                        type="text"
                        value={formatCurrency(deal.rentPerUnit)}
                        onChange={(e) => {
                          const rentPerUnit = parseCurrency(e.target.value)
                          handleInputChange('rentPerUnit', rentPerUnit)
                          // Auto-calculate total rent based on rented units
                          const totalUnits = deal.numberOfUnits || (deal.purchaseType === 'house_hack' ? 2 : 1)
                          const rentedUnits = deal.purchaseType === 'house_hack' ? totalUnits - 1 : totalUnits
                          if (rentPerUnit) {
                            handleInputChange('rentMonthly', rentPerUnit * rentedUnits)
                          } else {
                            handleInputChange('rentMonthly', null)
                          }
                        }}
                        className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Average monthly rent per rented unit</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Vacancy Rate (%)</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={deal.vacancyRatePerUnit ?? deal.vacancyRate ?? ''}
                        onChange={(e) => {
                          const rate = parsePercent(e.target.value)
                          handleInputChange('vacancyRatePerUnit', rate)
                          // If per-unit rate is set, use it for overall vacancy
                          if (rate !== null) {
                            handleInputChange('vacancyRate', rate)
                          }
                        }}
                        className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
                      />
                      <span className="absolute right-3 top-2 text-gray-500">%</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Expected vacancy rate for rented units</p>
                  </div>
                </div>
                
                {/* Summary of rental income */}
                <div className="mt-4 p-3 bg-white rounded border border-gray-200">
                  <div className="text-sm text-gray-600">
                    {deal.purchaseType === 'house_hack' ? (
                      <>
                        <strong>Rental Income:</strong> {formatCurrency(deal.rentMonthly || 0)}/month
                        {deal.rentPerUnit && deal.numberOfUnits && (
                          <span className="text-gray-500 ml-2">
                            ({(deal.numberOfUnits || 2) - 1} rented unit{(deal.numberOfUnits || 2) - 1 > 1 ? 's' : ''} × {formatCurrency(deal.rentPerUnit)})
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        <strong>Total Monthly Rent:</strong> {formatCurrency(deal.rentMonthly || 0)}
                        {deal.rentPerUnit && deal.numberOfUnits && (
                          <span className="text-gray-500 ml-2">
                            ({deal.numberOfUnits} units × {formatCurrency(deal.rentPerUnit)})
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {/* Standard Rental Income Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <label className="block text-sm font-medium text-gray-700">
                    {deal.purchaseType === 'house_hack' 
                      ? 'Rental Income (Monthly) *' 
                      : deal.numberOfUnits && deal.numberOfUnits > 1 
                        ? 'Total Rent (Monthly) *' 
                        : 'Rent (Monthly) *'}
                  </label>
                  {deal.assumedFields?.includes('rentMonthly') && (
                    <span className="px-2 py-0.5 text-xs font-medium rounded bg-yellow-100 text-yellow-800">
                      Assumed
                    </span>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-500">$</span>
                  <input
                    ref={el => { fieldRefs.current['rentMonthly'] = el }}
                    type="text"
                    value={formatCurrency(deal.rentMonthly)}
                    onChange={(e) => handleInputChange('rentMonthly', parseCurrency(e.target.value))}
                    className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
                  />
                </div>
                {deal.numberOfUnits && deal.rentPerUnit && (
                  <p className="text-xs text-gray-500 mt-1">
                    {deal.purchaseType === 'house_hack' 
                      ? `From ${(deal.numberOfUnits || 2) - 1} rented unit${(deal.numberOfUnits || 2) - 1 > 1 ? 's' : ''} × ${formatCurrency(deal.rentPerUnit)}/unit`
                      : `Auto-calculated from ${deal.numberOfUnits} units × ${formatCurrency(deal.rentPerUnit)}/unit`}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Other Income (Monthly)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-500">$</span>
                  <input
                    type="text"
                    value={formatCurrency(deal.otherIncomeMonthly)}
                    onChange={(e) => handleInputChange('otherIncomeMonthly', parseCurrency(e.target.value))}
                    className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Primary Residence Note */}
        {deal.purchaseType === 'primary_residence' && (
          <div className="bg-blue-50 rounded-lg border border-blue-200 p-6 mb-6">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div>
                <h3 className="text-sm font-semibold text-blue-900 mb-1">Primary Residence</h3>
                <p className="text-sm text-blue-800">
                  Rental income, vacancy, and management rates are set to $0. Maintenance and CapEx rates are set to 0.5% each (1% total annually) — the industry standard for homeowner reserves.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Assumptions */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Assumptions</h2>
          
          {/* Note for Primary Residence */}
          {deal.purchaseType === 'primary_residence' && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                For primary residences, vacancy and management rates are set to 0%. Maintenance and CapEx are set to 0.5% each (1% of home value annually) — you can adjust these if needed.
              </p>
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Vacancy Rate - Only show for non-primary residence */}
            {deal.purchaseType !== 'primary_residence' && (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <label className="block text-sm font-medium text-gray-700">Vacancy Rate (%) *</label>
                  {deal.assumedFields?.includes('vacancyRate') && (
                    <span className="px-2 py-0.5 text-xs font-medium rounded bg-yellow-100 text-yellow-800">
                      Assumed
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    ref={el => { fieldRefs.current['vacancyRate'] = el }}
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={deal.vacancyRate ?? ''}
                    onChange={(e) => handleInputChange('vacancyRate', parsePercent(e.target.value))}
                    className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
                  />
                  <span className="absolute right-3 top-2 text-gray-500">%</span>
                </div>
              </div>
            )}

            {/* Management Rate - Only show for non-primary residence */}
            {deal.purchaseType !== 'primary_residence' && (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <label className="block text-sm font-medium text-gray-700">Management Rate (%) *</label>
                  {deal.assumedFields?.includes('managementRate') && (
                    <span className="px-2 py-0.5 text-xs font-medium rounded bg-yellow-100 text-yellow-800">
                      Assumed
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    ref={el => { fieldRefs.current['managementRate'] = el }}
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={deal.managementRate ?? ''}
                    onChange={(e) => handleInputChange('managementRate', parsePercent(e.target.value))}
                    className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
                  />
                  <span className="absolute right-3 top-2 text-gray-500">%</span>
                </div>
              </div>
            )}

            {/* Maintenance Rate - Always editable */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <label className="block text-sm font-medium text-gray-700">Maintenance Rate (%) *</label>
                {deal.assumedFields?.includes('maintenanceRate') && (
                  <span className="px-2 py-0.5 text-xs font-medium rounded bg-yellow-100 text-yellow-800">
                    Assumed
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  ref={el => { fieldRefs.current['maintenanceRate'] = el }}
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={deal.maintenanceRate ?? ''}
                  onChange={(e) => handleInputChange('maintenanceRate', parsePercent(e.target.value))}
                  className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
                />
                <span className="absolute right-3 top-2 text-gray-500">%</span>
              </div>
            </div>

            {/* CapEx Rate - Always editable */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <label className="block text-sm font-medium text-gray-700">CapEx Rate (%) *</label>
                {deal.assumedFields?.includes('capexRate') && (
                  <span className="px-2 py-0.5 text-xs font-medium rounded bg-yellow-100 text-yellow-800">
                    Assumed
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  ref={el => { fieldRefs.current['capexRate'] = el }}
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={deal.capexRate ?? ''}
                  onChange={(e) => handleInputChange('capexRate', parsePercent(e.target.value))}
                  className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
                />
                <span className="absolute right-3 top-2 text-gray-500">%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Holding Period Projections - Available for all property types */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Holding Period Projections</h2>
          <p className="text-sm text-gray-600 mb-4">
            {deal.purchaseType === 'primary_residence' 
              ? 'Configure assumptions for multi-year projections to estimate appreciation, equity buildup, and potential return at sale.'
              : 'Configure assumptions for multi-year projections to estimate appreciation, cash flow growth, and total return.'}
          </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Holding Period */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Holding Period (Years)</label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  step="1"
                  value={deal.holdingPeriodYears ?? 10}
                  onChange={(e) => handleInputChange('holdingPeriodYears', parseInt(e.target.value) || 10)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
                />
              </div>
              
              {/* Appreciation Rate */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Annual Appreciation (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    min="-20"
                    max="20"
                    step="0.5"
                    value={deal.appreciationRate ?? 3}
                    onChange={(e) => handleInputChange('appreciationRate', parseFloat(e.target.value) || 3)}
                    className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
                  />
                  <span className="absolute right-3 top-2 text-gray-500">%</span>
                </div>
              </div>
              
              {/* Rent Growth Rate */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Annual Rent Growth (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    min="-10"
                    max="20"
                    step="0.5"
                    value={deal.rentGrowthRate ?? 2}
                    onChange={(e) => handleInputChange('rentGrowthRate', parseFloat(e.target.value) || 2)}
                    className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
                  />
                  <span className="absolute right-3 top-2 text-gray-500">%</span>
                </div>
              </div>
              
              {/* Expense Growth Rate */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Annual Expense Growth (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    min="-10"
                    max="20"
                    step="0.5"
                    value={deal.expenseGrowthRate ?? 2}
                    onChange={(e) => handleInputChange('expenseGrowthRate', parseFloat(e.target.value) || 2)}
                    className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
                  />
                  <span className="absolute right-3 top-2 text-gray-500">%</span>
                </div>
              </div>
              
              {/* Selling Costs */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Selling Costs (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="20"
                    step="0.5"
                    value={deal.sellingCostRate ?? 6}
                    onChange={(e) => handleInputChange('sellingCostRate', parseFloat(e.target.value) || 6)}
                    className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
                  />
                  <span className="absolute right-3 top-2 text-gray-500">%</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">Typically 5-6% for realtor fees + closing</p>
              </div>
            </div>
          </div>

        {/* Notes */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Notes</h2>
          <textarea
            value={deal.notes || ''}
            onChange={(e) => handleInputChange('notes', e.target.value || null)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
            placeholder="Add any notes about this deal..."
          />
        </div>

        {/* Analysis Section */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Analysis</h2>
            <div className="flex gap-2">
              <button
                onClick={handleAnalyze}
                disabled={analyzing || missingFields.length > 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {analyzing ? 'Analyzing...' : 'Run Analysis'}
              </button>
              <button
                onClick={handleShare}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Create Share Link
              </button>
            </div>
          </div>

          {analysis && (
            <div className="mt-6 space-y-4">
              {/* PRIMARY RESIDENCE: Homeowner-centric metrics */}
              {deal.purchaseType === 'primary_residence' && primaryResidenceOutputs ? (
                <>
                  {/* Headline Metrics */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* All-In Monthly Cost - Primary metric */}
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-5 rounded-lg border-2 border-blue-200">
                      <div className="text-sm text-blue-700 font-semibold mb-1 flex items-center gap-1">
                        All-In Monthly Cost
                        <div className="group relative inline-block">
                          <svg className="w-4 h-4 text-blue-500 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                          </svg>
                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block w-72 z-50 pointer-events-none">
                            <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 shadow-xl">
                              Your complete monthly cost to own this home: Mortgage (P&I), property taxes, insurance, HOA, and maintenance reserve. This is what you actually pay each month.
                              <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="text-3xl font-bold text-blue-900">${Math.round(primaryResidenceOutputs.allInMonthlyCost).toLocaleString()}<span className="text-lg font-normal">/mo</span></div>
                      <div className="text-xs text-blue-600 mt-2">${Math.round(primaryResidenceOutputs.allInMonthlyCost * 12).toLocaleString()}/year</div>
                    </div>

                    {/* Cash Required at Close */}
                    <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-5 rounded-lg border-2 border-amber-200">
                      <div className="text-sm text-amber-700 font-semibold mb-1 flex items-center gap-1">
                        Cash to Close
                        <div className="group relative inline-block">
                          <svg className="w-4 h-4 text-amber-500 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                          </svg>
                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block w-64 z-50 pointer-events-none">
                            <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 shadow-xl">
                              Total cash you need to bring to closing: down payment + closing costs + any initial repairs.
                              <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="text-3xl font-bold text-amber-900">${Math.round(primaryResidenceOutputs.cashRequiredAtClose).toLocaleString()}</div>
                      <div className="text-xs text-amber-600 mt-2">Down payment + closing + repairs</div>
                    </div>

                    {/* Annual Net Cost (True Cost) */}
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-5 rounded-lg border-2 border-purple-200">
                      <div className="text-sm text-purple-700 font-semibold mb-1 flex items-center gap-1">
                        True Annual Cost
                        <div className="group relative inline-block">
                          <svg className="w-4 h-4 text-purple-500 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                          </svg>
                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block w-72 z-50 pointer-events-none">
                            <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 shadow-xl">
                              Your real cost of housing after accounting for equity building. Total annual payments minus the principal portion (which builds your equity).
                              <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="text-3xl font-bold text-purple-900">${Math.round(primaryResidenceOutputs.annualNetCostOfOwnership).toLocaleString()}<span className="text-lg font-normal">/yr</span></div>
                      <div className="text-xs text-purple-600 mt-2">${Math.round(primaryResidenceOutputs.annualNetCostOfOwnership / 12).toLocaleString()}/mo effective cost</div>
                    </div>
                  </div>

                  {/* Cost Breakdown */}
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Monthly Cost Breakdown</h4>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                      <div className="flex flex-col">
                        <span className="text-gray-500 text-xs">Mortgage (P&I)</span>
                        <span className="font-semibold text-gray-900">${Math.round(primaryResidenceOutputs.mortgagePI).toLocaleString()}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-gray-500 text-xs">Property Taxes</span>
                        <span className="font-semibold text-gray-900">${Math.round(primaryResidenceOutputs.monthlyTaxes).toLocaleString()}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-gray-500 text-xs">Insurance</span>
                        <span className="font-semibold text-gray-900">${Math.round(primaryResidenceOutputs.monthlyInsurance).toLocaleString()}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-gray-500 text-xs">HOA</span>
                        <span className="font-semibold text-gray-900">${Math.round(primaryResidenceOutputs.monthlyHOA).toLocaleString()}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-gray-500 text-xs">Maintenance Reserve</span>
                        <span className="font-semibold text-gray-900">${Math.round(primaryResidenceOutputs.monthlyMaintenanceReserve).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Equity Building Insight */}
                  <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <div>
                        <h4 className="text-sm font-semibold text-green-800">Equity Building</h4>
                        <p className="text-sm text-green-700 mt-1">
                          Of your ${Math.round(primaryResidenceOutputs.allInMonthlyCost).toLocaleString()}/mo payment, approximately{' '}
                          <span className="font-semibold">${Math.round(primaryResidenceOutputs.annualPrincipalPaydown / 12).toLocaleString()}/mo</span>{' '}
                          goes toward building equity (principal paydown). This is not an expense—it&apos;s money you keep as home equity.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Advanced Investment Metrics - Hidden by default */}
                  <div className="border-t border-gray-200 pt-4">
                    <button
                      onClick={() => setShowAdvancedMetrics(!showAdvancedMetrics)}
                      className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
                    >
                      <svg className={`w-4 h-4 transition-transform ${showAdvancedMetrics ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                      {showAdvancedMetrics ? 'Hide' : 'Show'} investment metrics (for reference)
                    </button>
                    
                    {showAdvancedMetrics && (
                      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 opacity-75">
                        <div className="bg-gray-100 p-3 rounded-lg">
                          <div className="text-xs text-gray-500 mb-1">Cap Rate</div>
                          <div className="text-lg font-semibold text-gray-600">{analysis.outputs.capRate.toFixed(2)}%</div>
                        </div>
                        <div className="bg-gray-100 p-3 rounded-lg">
                          <div className="text-xs text-gray-500 mb-1">Cash-on-Cash</div>
                          <div className="text-lg font-semibold text-gray-600">{analysis.outputs.cashOnCash.toFixed(2)}%</div>
                        </div>
                        <div className="bg-gray-100 p-3 rounded-lg">
                          <div className="text-xs text-gray-500 mb-1">NOI (Annual)</div>
                          <div className="text-lg font-semibold text-gray-600">${analysis.outputs.noiAnnual.toLocaleString()}</div>
                        </div>
                        <div className="bg-gray-100 p-3 rounded-lg">
                          <div className="text-xs text-gray-500 mb-1">DSCR</div>
                          <div className="text-lg font-semibold text-gray-600">{analysis.outputs.dscr.toFixed(2)}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                /* INVESTMENT PROPERTIES: Original metrics grid */
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-800 font-medium mb-1 flex items-center gap-1">
                      Total Monthly Payment
                      <div className="group relative inline-block">
                        <svg className="w-4 h-4 text-gray-500 cursor-help hover:text-gray-700" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block w-64 z-50 pointer-events-none">
                          <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 shadow-xl">
                            Total of all monthly expenses: Principal & Interest, PMI, Taxes, Insurance, HOA, and Utilities.
                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="text-xl font-semibold text-gray-900">${analysis.outputs.totalMonthlyPayment.toLocaleString()}</div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm font-medium mb-1 flex items-center gap-1 text-gray-800">
                      NOI (Annual)
                      <div className="group relative inline-block">
                        <svg className="w-4 h-4 text-gray-500 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block w-64 z-10">
                          <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 shadow-lg">
                            Net Operating Income: Annual income after operating expenses but before debt service. Measures property profitability.
                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="text-xl font-semibold text-gray-900">${analysis.outputs.noiAnnual.toLocaleString()}</div>
                  </div>
                  {/* Cash Flow */}
                  <div className={`p-4 rounded-lg ${
                    deal.purchaseType === 'house_hack'
                      ? 'bg-purple-50 border-2 border-purple-200'
                      : 'bg-blue-50 border-2 border-blue-200'
                  }`}>
                    <div className="text-sm text-gray-800 font-medium mb-1 flex items-center gap-1">
                      {deal.purchaseType === 'house_hack' ? 'Net Housing Cost' : 'Cash Flow (Annual)'}
                      <div className="group relative inline-block">
                        <svg className="w-4 h-4 text-gray-500 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block w-64 z-10">
                          <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 shadow-lg">
                            {deal.purchaseType === 'house_hack'
                              ? 'Your net housing cost after rental income from other units offsets expenses. Negative = you live for free + profit!'
                              : 'Annual profit or loss after all expenses including debt service. Positive = cash flow positive, Negative = losing money monthly.'}
                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                    {deal.purchaseType === 'house_hack' ? (
                      <div className={`text-xl font-semibold ${analysis.outputs.cashFlowAnnual >= 0 ? 'text-green-700' : 'text-purple-700'}`}>
                        {analysis.outputs.cashFlowAnnual >= 0 ? (
                          <>
                            <span className="text-green-700">FREE + ${analysis.outputs.cashFlowAnnual.toLocaleString()}/yr profit</span>
                            <span className="text-sm font-normal text-green-600 ml-1">
                              (${Math.round(analysis.outputs.cashFlowAnnual / 12).toLocaleString()}/mo)
                            </span>
                          </>
                        ) : (
                          <>
                            ${Math.abs(analysis.outputs.cashFlowAnnual).toLocaleString()}/yr
                            <span className="text-sm font-normal text-purple-600 ml-1">
                              (${Math.round(Math.abs(analysis.outputs.cashFlowAnnual) / 12).toLocaleString()}/mo to live here)
                            </span>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className={`text-xl font-semibold ${analysis.outputs.cashFlowAnnual >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        ${analysis.outputs.cashFlowAnnual.toLocaleString()}
                        <span className="text-sm font-normal ml-1">
                          (${Math.round(analysis.outputs.cashFlowAnnual / 12).toLocaleString()}/mo)
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Cap Rate */}
                  <div className="bg-green-50 border-2 border-green-200 p-4 rounded-lg">
                    <div className="text-sm font-medium mb-1 flex items-center gap-1 text-gray-800">
                      Cap Rate
                      <div className="group relative inline-block">
                        <svg className="w-4 h-4 text-gray-500 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block w-64 z-10">
                          <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 shadow-lg">
                            Capitalization Rate: Annual return on purchase price assuming all-cash purchase. Formula: (NOI Annual / Purchase Price) × 100. 4-6% typical, 8%+ high returns.
                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="text-xl font-semibold text-green-700">{analysis.outputs.capRate.toFixed(2)}%</div>
                  </div>

                  {/* Cash-on-Cash */}
                  <div className="bg-green-50 border-2 border-green-200 p-4 rounded-lg">
                    <div className="text-sm font-medium mb-1 flex items-center gap-1 text-gray-800">
                      Cash-on-Cash Return
                      <div className="group relative inline-block">
                        <svg className="w-4 h-4 text-gray-500 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block w-64 z-10">
                          <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 shadow-lg">
                            Return on actual cash invested (down payment + closing costs + rehab). Formula: (Cash Flow Annual / All-In Cash) × 100. Higher is better.
                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="text-xl font-semibold text-green-700">{analysis.outputs.cashOnCash.toFixed(2)}%</div>
                  </div>

                  {/* DSCR */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm font-medium mb-1 flex items-center gap-1 text-gray-800">
                      DSCR
                      <div className="group relative inline-block">
                        <svg className="w-4 h-4 text-gray-500 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block w-64 z-10">
                          <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 shadow-lg">
                            Debt Service Coverage Ratio: Property&apos;s ability to cover debt payments. Formula: NOI Annual / Annual Debt Service. Lenders typically require ≥ 1.25.
                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="text-xl font-semibold text-gray-900">{analysis.outputs.dscr.toFixed(2)}</div>
                  </div>

                  {/* Break-Even Rent */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-800 font-medium mb-1 flex items-center gap-1">
                      Break-Even Rent
                      <div className="group relative inline-block">
                        <svg className="w-4 h-4 text-gray-500 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block w-64 z-10">
                          <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 shadow-lg">
                            Minimum monthly rent needed to achieve zero cash flow (break-even). Accounts for vacancy, maintenance, CapEx, and management costs.
                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="text-xl font-semibold text-gray-900">${analysis.outputs.breakEvenRentMonthly.toLocaleString()}</div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-800 font-medium mb-1 flex items-center gap-1">
                      All-In Cash
                      <div className="group relative inline-block">
                        <svg className="w-4 h-4 text-gray-500 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block w-64 z-10">
                          <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 shadow-lg">
                            Total cash required to close the deal: Down Payment + Closing Costs + Rehab. This is your total initial investment.
                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="text-xl font-semibold text-gray-900">${analysis.outputs.allInCashRequired.toLocaleString()}</div>
                  </div>
                </div>
              )}
              
              {/* Analysis Summary */}
              <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Summary</h3>
                <p className="text-gray-700 leading-relaxed">
                  {deal.purchaseType === 'primary_residence' && primaryResidenceOutputs ? (
                    <>
                      <span className="font-semibold">Can you afford this home?</span> You&apos;ll need{' '}
                      <span className="font-semibold">${Math.round(primaryResidenceOutputs.cashRequiredAtClose).toLocaleString()}</span> in cash to close.{' '}
                      Your all-in monthly cost to live here is{' '}
                      <span className="font-semibold">${Math.round(primaryResidenceOutputs.allInMonthlyCost).toLocaleString()}/month</span>{' '}
                      (${Math.round(primaryResidenceOutputs.allInMonthlyCost * 12).toLocaleString()}/year).{' '}
                      However, <span className="font-semibold">${Math.round(primaryResidenceOutputs.annualPrincipalPaydown / 12).toLocaleString()}/month</span>{' '}
                      of that goes toward building equity, so your <span className="font-semibold">true cost of housing</span> is approximately{' '}
                      <span className="font-semibold">${Math.round(primaryResidenceOutputs.annualNetCostOfOwnership / 12).toLocaleString()}/month</span>.
                    </>
                  ) : deal.purchaseType === 'house_hack' ? (
                    <>
                      <span className="font-semibold">House Hack Analysis:</span> You&apos;ll need{' '}
                      <span className="font-semibold">${analysis.outputs.allInCashRequired.toLocaleString()}</span> in cash to close.{' '}
                      {analysis.outputs.cashFlowAnnual >= 0 ? (
                        <>
                          With rental income from {(deal.numberOfUnits || 2) - 1} unit{(deal.numberOfUnits || 2) - 1 > 1 ? 's' : ''}, 
                          you&apos;ll <span className="font-semibold text-green-700">live for free and profit ${analysis.outputs.cashFlowAnnual.toLocaleString()}</span>/year 
                          (<span className="font-semibold">${Math.round(analysis.outputs.cashFlowAnnual / 12).toLocaleString()}</span>/month).
                        </>
                      ) : (
                        <>
                          With rental income from {(deal.numberOfUnits || 2) - 1} unit{(deal.numberOfUnits || 2) - 1 > 1 ? 's' : ''}, 
                          your <span className="font-semibold text-purple-700">net housing cost is ${Math.abs(analysis.outputs.cashFlowAnnual).toLocaleString()}</span>/year 
                          (<span className="font-semibold">${Math.abs(Math.round(analysis.outputs.cashFlowAnnual / 12)).toLocaleString()}</span>/month).
                          {deal.rentMonthly && deal.rentMonthly > 0 && (
                            <> The rental income saves you <span className="font-semibold">${(deal.rentMonthly * 12).toLocaleString()}</span>/year vs. owning alone.</>
                          )}
                        </>
                      )}
                      {' '}Cap rate: <span className="font-semibold">{analysis.outputs.capRate.toFixed(1)}%</span>.
                      {' '}Cash-on-cash: <span className="font-semibold">{analysis.outputs.cashOnCash.toFixed(1)}%</span>.
                    </>
                  ) : (
                    <>
                      <span className="font-semibold">Investment Analysis:</span> This deal requires{' '}
                      <span className="font-semibold">${analysis.outputs.allInCashRequired.toLocaleString()}</span> in total cash to acquire.{' '}
                      {analysis.outputs.cashFlowAnnual >= 0 ? (
                        <>
                          The property is projected to <span className="font-semibold text-green-700">return ${analysis.outputs.cashFlowAnnual.toLocaleString()}</span> annually 
                          (<span className="font-semibold">${Math.round(analysis.outputs.cashFlowAnnual / 12).toLocaleString()}</span>/month in profit), 
                          yielding a <span className="font-semibold text-green-700">{analysis.outputs.cashOnCash.toFixed(1)}% cash-on-cash return</span>.
                        </>
                      ) : (
                        <>
                          The property is projected to <span className="font-semibold text-red-700">lose ${Math.abs(analysis.outputs.cashFlowAnnual).toLocaleString()}</span> annually 
                          (<span className="font-semibold">${Math.abs(Math.round(analysis.outputs.cashFlowAnnual / 12)).toLocaleString()}</span>/month shortfall).
                        </>
                      )}
                      {' '}With a <span className="font-semibold text-green-700">{analysis.outputs.capRate.toFixed(1)}% cap rate</span> and{' '}
                      <span className="font-semibold">{analysis.outputs.dscr.toFixed(2)} DSCR</span>
                      {analysis.outputs.dscr >= 1.25 ? (
                        <> (exceeds lender requirement of 1.25), this property shows strong investment fundamentals.</>
                      ) : analysis.outputs.dscr >= 1.0 ? (
                        <> (covers debt but below typical lender requirement of 1.25), this property may require additional scrutiny.</>
                      ) : (
                        <> (below 1.0 - does not cover debt payments), this property needs higher rent or lower expenses to be viable.</>
                      )}
                      {' '}Break-even rent: <span className="font-semibold">${analysis.outputs.breakEvenRentMonthly.toLocaleString()}</span>/month.
                    </>
                  )}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Holding Period Analysis - Available for all property types */}
        {holdingPeriodAnalysis && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              {deal.purchaseType === 'primary_residence' 
                ? `${deal.holdingPeriodYears || 10}-Year Ownership Analysis`
                : `${deal.holdingPeriodYears || 10}-Year Holding Period Analysis`}
            </h2>
            
            {/* PRIMARY RESIDENCE: Time, flexibility, and risk focused metrics */}
            {deal.purchaseType === 'primary_residence' && primaryResidenceHoldingPeriod ? (
              <>
                {/* Core Ownership Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {/* Equity Accumulation */}
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
                    <div className="text-sm font-semibold text-blue-700 mb-1">Total Equity Built</div>
                    <div className="text-2xl font-bold text-blue-900">
                      ${Math.round(primaryResidenceHoldingPeriod.totalEquityAccumulation).toLocaleString()}
                    </div>
                    <div className="text-xs text-blue-600 mt-2 space-y-1">
                      <div>Principal paydown: ${Math.round(primaryResidenceHoldingPeriod.equityFromPrincipalPaydown).toLocaleString()}</div>
                      <div>Appreciation: ${Math.round(primaryResidenceHoldingPeriod.equityFromAppreciation).toLocaleString()}</div>
                    </div>
                  </div>

                  {/* Net Housing Cost */}
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
                    <div className="text-sm font-semibold text-purple-700 mb-1">Effective Monthly Cost</div>
                    <div className="text-2xl font-bold text-purple-900">
                      ${Math.round(primaryResidenceHoldingPeriod.netCostOfHousingMonthlyEquivalent).toLocaleString()}<span className="text-lg font-normal">/mo</span>
                    </div>
                    <div className="text-xs text-purple-600 mt-2">
                      Total over {deal.holdingPeriodYears || 10} years: ${Math.round(primaryResidenceHoldingPeriod.netCostOfHousingTotal).toLocaleString()}
                    </div>
                  </div>

                  {/* Break-even vs Renting */}
                  <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
                    <div className="text-sm font-semibold text-green-700 mb-1">Break-Even vs Renting</div>
                    <div className="text-2xl font-bold text-green-900">
                      {primaryResidenceHoldingPeriod.breakEvenYearBuyVsRent 
                        ? `Year ${primaryResidenceHoldingPeriod.breakEvenYearBuyVsRent}` 
                        : 'N/A'}
                    </div>
                    <div className="text-xs text-green-600 mt-2">
                      {primaryResidenceHoldingPeriod.breakEvenYearBuyVsRent 
                        ? `Ownership beats renting after ${primaryResidenceHoldingPeriod.breakEvenYearBuyVsRent} year${primaryResidenceHoldingPeriod.breakEvenYearBuyVsRent > 1 ? 's' : ''}` 
                        : 'Enter market rent to calculate'}
                    </div>
                  </div>
                </div>

                {/* Exit Flexibility - What if you need to sell? */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">What If You Need to Sell?</h3>
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      {primaryResidenceHoldingPeriod.exitScenarios.map((scenario) => (
                        <div key={scenario.year} className="text-center p-3 bg-white rounded-lg border border-gray-100">
                          <div className="text-xs text-gray-500 mb-1">After {scenario.year} Years</div>
                          <div className={`text-lg font-bold ${scenario.netProceedsFromSale >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                            ${Math.round(scenario.netProceedsFromSale).toLocaleString()}
                          </div>
                          <div className="text-xs text-gray-500">net proceeds at sale</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Downside Scenarios */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Sensitivity Analysis</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Flat Price Scenario */}
                    <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                      <div className="text-sm font-semibold text-amber-800 mb-2">If Prices Stay Flat (0% growth)</div>
                      <div className="text-sm text-amber-700 space-y-1">
                        <div>Net proceeds at sale: <span className={`font-semibold ${primaryResidenceHoldingPeriod.flatPriceScenario.netProceedsAtSale >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                          ${Math.round(primaryResidenceHoldingPeriod.flatPriceScenario.netProceedsAtSale).toLocaleString()}
                        </span></div>
                        <div>Effective monthly cost: <span className="font-semibold">${Math.round(primaryResidenceHoldingPeriod.flatPriceScenario.effectiveMonthlyCost).toLocaleString()}/mo</span></div>
                      </div>
                    </div>

                    {/* Negative Price Scenario */}
                    <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                      <div className="text-sm font-semibold text-red-800 mb-2">If Prices Drop 10%</div>
                      <div className="text-sm text-red-700 space-y-1">
                        <div>Net proceeds at sale: <span className={`font-semibold ${primaryResidenceHoldingPeriod.negativePriceScenario.netProceedsAtSale >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                          ${Math.round(primaryResidenceHoldingPeriod.negativePriceScenario.netProceedsAtSale).toLocaleString()}
                        </span></div>
                        <div>Effective monthly cost: <span className="font-semibold">${Math.round(primaryResidenceHoldingPeriod.negativePriceScenario.effectiveMonthlyCost).toLocaleString()}/mo</span></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Advanced Investment Metrics - Hidden behind toggle */}
                <div className="border-t border-gray-200 pt-4">
                  <button
                    onClick={() => setShowAdvancedMetrics(!showAdvancedMetrics)}
                    className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
                  >
                    <svg className={`w-4 h-4 transition-transform ${showAdvancedMetrics ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                    {showAdvancedMetrics ? 'Hide' : 'Show'} IRR and investment metrics
                  </button>
                  
                  {showAdvancedMetrics && (
                    <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 opacity-75">
                      <div className="bg-gray-100 p-3 rounded-lg">
                        <div className="text-xs text-gray-500 mb-1">IRR</div>
                        <div className={`text-lg font-semibold ${holdingPeriodAnalysis.irr >= 0 ? 'text-gray-600' : 'text-red-600'}`}>{holdingPeriodAnalysis.irr.toFixed(1)}%</div>
                      </div>
                      <div className="bg-gray-100 p-3 rounded-lg">
                        <div className="text-xs text-gray-500 mb-1">Equity Multiple</div>
                        <div className="text-lg font-semibold text-gray-600">{holdingPeriodAnalysis.equityMultiple.toFixed(2)}x</div>
                      </div>
                      <div className="bg-gray-100 p-3 rounded-lg">
                        <div className="text-xs text-gray-500 mb-1">Total ROI</div>
                        <div className={`text-lg font-semibold ${holdingPeriodAnalysis.exitScenario.totalROI >= 0 ? 'text-gray-600' : 'text-red-600'}`}>{holdingPeriodAnalysis.exitScenario.totalROI.toFixed(1)}%</div>
                      </div>
                      <div className="bg-gray-100 p-3 rounded-lg">
                        <div className="text-xs text-gray-500 mb-1">Net Proceeds</div>
                        <div className="text-lg font-semibold text-gray-600">${holdingPeriodAnalysis.exitScenario.netProceedsFromSale.toLocaleString()}</div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* INVESTMENT PROPERTIES: Original IRR-focused metrics */
              <>
                {/* Return Metrics Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
                    <div className="text-sm font-medium text-green-700 mb-1">Internal Rate of Return</div>
                    <div className={`text-2xl font-bold ${holdingPeriodAnalysis.irr >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                      {holdingPeriodAnalysis.irr.toFixed(1)}%
                    </div>
                    <div className="text-xs text-green-600 mt-1">Annualized return on investment</div>
                  </div>
                  
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
                    <div className="text-sm font-medium text-blue-700 mb-1">Equity Multiple</div>
                    <div className="text-2xl font-bold text-blue-700">
                      {holdingPeriodAnalysis.equityMultiple.toFixed(2)}x
                    </div>
                    <div className="text-xs text-blue-600 mt-1">Total return / cash invested</div>
                  </div>
                  
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
                    <div className="text-sm font-medium text-purple-700 mb-1">Total Profit</div>
                    <div className={`text-2xl font-bold ${holdingPeriodAnalysis.exitScenario.totalProfit >= 0 ? 'text-purple-700' : 'text-red-600'}`}>
                      ${Math.abs(holdingPeriodAnalysis.exitScenario.totalProfit).toLocaleString()}
                    </div>
                    <div className="text-xs text-purple-600 mt-1">Cash flow + sale proceeds - investment</div>
                  </div>
                  
                  <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-4 border border-amber-200">
                    <div className="text-sm font-medium text-amber-700 mb-1">Total ROI</div>
                    <div className={`text-2xl font-bold ${holdingPeriodAnalysis.exitScenario.totalROI >= 0 ? 'text-amber-700' : 'text-red-600'}`}>
                      {holdingPeriodAnalysis.exitScenario.totalROI.toFixed(1)}%
                    </div>
                    <div className="text-xs text-amber-600 mt-1">Profit / initial investment</div>
                  </div>
                </div>
              </>
            )}

            {/* Exit Scenario - Investment properties only */}
            {deal.purchaseType !== 'primary_residence' && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Exit Scenario (Year {deal.holdingPeriodYears || 10})</h3>
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Sale Price:</span>
                      <span className="font-semibold text-gray-900 ml-2">
                        ${holdingPeriodAnalysis.exitScenario.salePrice.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Selling Costs:</span>
                      <span className="font-semibold text-red-600 ml-2">
                        -${holdingPeriodAnalysis.exitScenario.sellingCosts.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Loan Payoff:</span>
                      <span className="font-semibold text-red-600 ml-2">
                        -${holdingPeriodAnalysis.exitScenario.loanPayoff.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Net Proceeds:</span>
                      <span className="font-semibold text-green-700 ml-2">
                        ${holdingPeriodAnalysis.exitScenario.netProceedsFromSale.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Cumulative Cash Flow:</span>
                      <span className={`font-semibold ml-2 ${holdingPeriodAnalysis.exitScenario.cumulativeCashFlow >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                        ${holdingPeriodAnalysis.exitScenario.cumulativeCashFlow.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Initial Investment:</span>
                      <span className="font-semibold text-gray-900 ml-2">
                        ${holdingPeriodAnalysis.exitScenario.initialInvestment.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Equity Buildup Chart */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Equity Growth Over Time</h3>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                {/* Simple bar chart using CSS */}
                <div className="space-y-2">
                  {holdingPeriodAnalysis.yearlyProjections.map((year, idx) => {
                    const maxEquity = holdingPeriodAnalysis.yearlyProjections[holdingPeriodAnalysis.yearlyProjections.length - 1].equity
                    const equityPercent = (year.equity / maxEquity) * 100
                    const appreciationEquity = year.propertyValue - (deal.purchasePrice || 0)
                    const principalEquity = (deal.purchasePrice || 0) * ((deal.downPaymentPct || 20) / 100) + 
                      holdingPeriodAnalysis.yearlyProjections.slice(0, idx + 1).reduce((sum, y) => sum + y.principalPaidAnnual, 0)
                    
                    return (
                      <div key={year.year} className="flex items-center gap-2">
                        <div className="w-12 text-right text-xs text-gray-600">Yr {year.year}</div>
                        <div className="flex-1 h-6 bg-gray-200 rounded-full overflow-hidden relative">
                          <div 
                            className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(100, equityPercent)}%` }}
                          />
                        </div>
                        <div className="w-24 text-right text-xs font-medium text-gray-900">
                          ${(year.equity / 1000).toFixed(0)}K
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="mt-4 flex gap-4 text-xs text-gray-600">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-blue-500"></div>
                    <span>Principal Paydown</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-green-500"></div>
                    <span>Appreciation</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Cash Flow Schedule - Investment properties only */}
            {deal.purchaseType !== 'primary_residence' && (
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-lg font-semibold text-gray-900">Cash Flow Schedule</h3>
                  <button
                    onClick={() => setShowCashFlowSchedule(!showCashFlowSchedule)}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    {showCashFlowSchedule ? 'Hide Details' : 'Show Details'}
                  </button>
                </div>
                
                {showCashFlowSchedule && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-100 text-left">
                          <th className="px-3 py-2 font-semibold text-gray-700">Year</th>
                          <th className="px-3 py-2 font-semibold text-gray-700 text-right">Property Value</th>
                          <th className="px-3 py-2 font-semibold text-gray-700 text-right">Rent (Annual)</th>
                          <th className="px-3 py-2 font-semibold text-gray-700 text-right">NOI</th>
                          <th className="px-3 py-2 font-semibold text-gray-700 text-right">Cash Flow</th>
                          <th className="px-3 py-2 font-semibold text-gray-700 text-right">Cumulative CF</th>
                          <th className="px-3 py-2 font-semibold text-gray-700 text-right">Loan Balance</th>
                          <th className="px-3 py-2 font-semibold text-gray-700 text-right">Equity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {holdingPeriodAnalysis.yearlyProjections.map((year) => (
                          <tr key={year.year} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-3 py-2 font-medium text-gray-900">{year.year}</td>
                            <td className="px-3 py-2 text-right text-gray-700">
                              ${year.propertyValue.toLocaleString()}
                            </td>
                            <td className="px-3 py-2 text-right text-gray-700">
                              ${year.rentAnnual.toLocaleString()}
                            </td>
                            <td className="px-3 py-2 text-right text-gray-700">
                              ${year.noiAnnual.toLocaleString()}
                            </td>
                            <td className={`px-3 py-2 text-right font-medium ${year.cashFlowAnnual >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              ${year.cashFlowAnnual.toLocaleString()}
                            </td>
                            <td className={`px-3 py-2 text-right ${year.cumulativeCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              ${year.cumulativeCashFlow.toLocaleString()}
                            </td>
                            <td className="px-3 py-2 text-right text-gray-700">
                              ${year.loanBalance.toLocaleString()}
                            </td>
                            <td className="px-3 py-2 text-right font-medium text-blue-600">
                              ${year.equity.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                
                {!showCashFlowSchedule && (
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Year 1 Cash Flow:</span>
                        <span className={`font-semibold ml-2 ${holdingPeriodAnalysis.yearlyProjections[0].cashFlowAnnual >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                          ${holdingPeriodAnalysis.yearlyProjections[0].cashFlowAnnual.toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Year {Math.ceil(holdingPeriodAnalysis.yearlyProjections.length / 2)} Cash Flow:</span>
                        <span className={`font-semibold ml-2 ${holdingPeriodAnalysis.yearlyProjections[Math.ceil(holdingPeriodAnalysis.yearlyProjections.length / 2) - 1].cashFlowAnnual >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                          ${holdingPeriodAnalysis.yearlyProjections[Math.ceil(holdingPeriodAnalysis.yearlyProjections.length / 2) - 1].cashFlowAnnual.toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Final Year Cash Flow:</span>
                        <span className={`font-semibold ml-2 ${holdingPeriodAnalysis.yearlyProjections[holdingPeriodAnalysis.yearlyProjections.length - 1].cashFlowAnnual >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                          ${holdingPeriodAnalysis.yearlyProjections[holdingPeriodAnalysis.yearlyProjections.length - 1].cashFlowAnnual.toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Final Equity:</span>
                        <span className="font-semibold text-blue-700 ml-2">
                          ${holdingPeriodAnalysis.yearlyProjections[holdingPeriodAnalysis.yearlyProjections.length - 1].equity.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Holding Period Summary */}
            <div className="mt-6 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-200">
              <h3 className="text-lg font-semibold text-indigo-900 mb-2">
                {deal.purchaseType === 'primary_residence' ? 'Ownership Summary' : 'Holding Period Summary'}
              </h3>
              <p className="text-indigo-800 leading-relaxed">
                {deal.purchaseType === 'primary_residence' && primaryResidenceHoldingPeriod ? (
                  <>
                    <span className="font-semibold">What does it cost to live here over {deal.holdingPeriodYears || 10} years?</span>{' '}
                    Your effective monthly housing cost is approximately{' '}
                    <span className="font-semibold">${Math.round(primaryResidenceHoldingPeriod.netCostOfHousingMonthlyEquivalent).toLocaleString()}/month</span>{' '}
                    after accounting for equity building.{' '}
                    Over this period, you&apos;ll build{' '}
                    <span className="font-semibold">${Math.round(primaryResidenceHoldingPeriod.totalEquityAccumulation).toLocaleString()}</span>{' '}
                    in equity (<span className="font-semibold">${Math.round(primaryResidenceHoldingPeriod.equityFromPrincipalPaydown).toLocaleString()}</span>{' '}
                    from principal paydown, <span className="font-semibold">${Math.round(primaryResidenceHoldingPeriod.equityFromAppreciation).toLocaleString()}</span>{' '}
                    from appreciation).{' '}
                    If you sell at year {deal.holdingPeriodYears || 10}, you would walk away with approximately{' '}
                    <span className={`font-semibold ${holdingPeriodAnalysis.exitScenario.netProceedsFromSale >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      ${Math.round(holdingPeriodAnalysis.exitScenario.netProceedsFromSale).toLocaleString()}
                    </span>{' '}
                    after paying off the mortgage and selling costs.
                  </>
                ) : (
                  <>
                    Over <span className="font-semibold">{deal.holdingPeriodYears || 10} years</span>, this investment is projected to generate 
                    a <span className="font-semibold">{holdingPeriodAnalysis.irr.toFixed(1)}% IRR</span> with an equity multiple of{' '}
                    <span className="font-semibold">{holdingPeriodAnalysis.equityMultiple.toFixed(2)}x</span>.{' '}
                    Starting with <span className="font-semibold">${holdingPeriodAnalysis.exitScenario.initialInvestment.toLocaleString()}</span> invested, 
                    you would receive <span className="font-semibold">${holdingPeriodAnalysis.exitScenario.cumulativeCashFlow.toLocaleString()}</span> in 
                    cumulative cash flow during the hold, plus <span className="font-semibold">${holdingPeriodAnalysis.exitScenario.netProceedsFromSale.toLocaleString()}</span> at 
                    sale, for a total profit of{' '}
                    <span className={`font-semibold ${holdingPeriodAnalysis.exitScenario.totalProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      ${holdingPeriodAnalysis.exitScenario.totalProfit.toLocaleString()}
                    </span>.
                    {holdingPeriodAnalysis.exitScenario.totalROI >= 100 && (
                      <> This represents more than doubling your initial investment!</>
                    )}
                  </>
                )}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
