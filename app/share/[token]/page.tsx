'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Deal, Analysis } from '@/lib/types'

export default function SharePage() {
  const params = useParams()
  const token = params.token as string
  
  const [deal, setDeal] = useState<Deal | null>(null)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchShare()
  }, [token])

  const fetchShare = async () => {
    try {
      const res = await fetch(`/api/share/${token}`)
      if (!res.ok) {
        if (res.status === 404) {
          setError('Share link not found or has been revoked')
        } else {
          setError('Failed to load share')
        }
        return
      }
      const data = await res.json()
      setDeal(data.deal)
      setAnalysis(data.analysis)
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    )
  }

  if (error || !deal) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Deal not found'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg border border-gray-200 p-8 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">DealMetrics Report</h1>
          <p className="text-gray-600">Shared deal analysis</p>
        </div>

        {/* Property Summary */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Property Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-600">Address</div>
              <div className="font-medium">{deal.address || '—'}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Property Type</div>
              <div className="font-medium">{deal.propertyType || '—'}</div>
            </div>
            {deal.beds !== null && deal.baths !== null && (
              <div>
                <div className="text-sm text-gray-600">Beds / Baths</div>
                <div className="font-medium">{deal.beds} / {deal.baths}</div>
              </div>
            )}
            {deal.sqft !== null && (
              <div>
                <div className="text-sm text-gray-600">Square Feet</div>
                <div className="font-medium">{deal.sqft.toLocaleString()}</div>
              </div>
            )}
            <div>
              <div className="text-sm text-gray-600">Purchase Price</div>
              <div className="font-medium">{formatCurrency(deal.purchasePrice)}</div>
            </div>
          </div>
        </div>

        {/* Assumptions Snapshot */}
        {analysis && (
          <>
            <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Assumptions</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-gray-600">Down Payment</div>
                  <div className="font-medium">{analysis.inputs.downPaymentPct}%</div>
                </div>
                <div>
                  <div className="text-gray-600">Interest Rate</div>
                  <div className="font-medium">{analysis.inputs.interestRate}%</div>
                </div>
                <div>
                  <div className="text-gray-600">Loan Term</div>
                  <div className="font-medium">{analysis.inputs.termYears} years</div>
                </div>
                <div>
                  <div className="text-gray-600">Vacancy Rate</div>
                  <div className="font-medium">{analysis.inputs.vacancyRate}%</div>
                </div>
                <div>
                  <div className="text-gray-600">Maintenance</div>
                  <div className="font-medium">{analysis.inputs.maintenanceRate}%</div>
                </div>
                <div>
                  <div className="text-gray-600">CapEx</div>
                  <div className="font-medium">{analysis.inputs.capexRate}%</div>
                </div>
                <div>
                  <div className="text-gray-600">Management</div>
                  <div className="font-medium">{analysis.inputs.managementRate}%</div>
                </div>
              </div>
            </div>

            {/* Key Outputs */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Key Outputs</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600">Total Monthly Payment</div>
                  <div className="text-xl font-semibold">{formatCurrency(analysis.outputs.totalMonthlyPayment)}</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600">NOI (Annual)</div>
                  <div className="text-xl font-semibold">{formatCurrency(analysis.outputs.noiAnnual)}</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600">Cash Flow (Annual)</div>
                  <div className={`text-xl font-semibold ${analysis.outputs.cashFlowAnnual >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(analysis.outputs.cashFlowAnnual)}
                  </div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600">Cap Rate</div>
                  <div className="text-xl font-semibold">{analysis.outputs.capRate.toFixed(2)}%</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600">Cash-on-Cash</div>
                  <div className="text-xl font-semibold">{analysis.outputs.cashOnCash.toFixed(2)}%</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600">DSCR</div>
                  <div className="text-xl font-semibold">{analysis.outputs.dscr.toFixed(2)}</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600">Break-Even Rent</div>
                  <div className="text-xl font-semibold">{formatCurrency(analysis.outputs.breakEvenRentMonthly)}</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600">All-In Cash Required</div>
                  <div className="text-xl font-semibold">{formatCurrency(analysis.outputs.allInCashRequired)}</div>
                </div>
              </div>
            </div>

            <div className="text-center text-sm text-gray-500">
              Analysis generated: {formatDate(analysis.createdAt)}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
