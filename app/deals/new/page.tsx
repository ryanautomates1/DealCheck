'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function NewDealPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    address: '',
    purchasePrice: '',
    rentMonthly: '',
    taxesAnnual: '',
    insuranceAnnual: '',
    interestRate: '7',
    downPaymentPct: '20',
    termYears: '30',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const payload: any = {}
      if (formData.address) payload.address = formData.address
      if (formData.purchasePrice) payload.purchasePrice = parseFloat(formData.purchasePrice)
      if (formData.rentMonthly) payload.rentMonthly = parseFloat(formData.rentMonthly)
      if (formData.taxesAnnual) payload.taxesAnnual = parseFloat(formData.taxesAnnual)
      if (formData.insuranceAnnual) payload.insuranceAnnual = parseFloat(formData.insuranceAnnual)
      if (formData.interestRate) payload.interestRate = parseFloat(formData.interestRate)
      if (formData.downPaymentPct) payload.downPaymentPct = parseFloat(formData.downPaymentPct)
      if (formData.termYears) payload.termYears = parseInt(formData.termYears)

      const res = await fetch('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create deal')
      }

      const data = await res.json()
      router.push(`/deals/${data.deal.id}`)
    } catch (err: any) {
      setError(err.message || 'An error occurred')
      setLoading(false)
    }
  }

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Create Manual Deal</h1>
          <p className="mt-2 text-gray-600">Enter deal information manually</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-800">
              <strong>Tip:</strong> Use the Chrome extension to auto-import listings from supported real estate sites.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">
                Address (optional)
              </label>
              <input
                type="text"
                id="address"
                value={formData.address}
                onChange={(e) => handleChange('address', e.target.value)}
                placeholder="123 Main St, City, ST 12345"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="purchasePrice" className="block text-sm font-medium text-gray-700 mb-2">
                  Purchase Price
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-500">$</span>
                  <input
                    type="number"
                    id="purchasePrice"
                    value={formData.purchasePrice}
                    onChange={(e) => handleChange('purchasePrice', e.target.value)}
                    placeholder="0"
                    min="0"
                    step="1000"
                    className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="rentMonthly" className="block text-sm font-medium text-gray-700 mb-2">
                  Monthly Rent
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-500">$</span>
                  <input
                    type="number"
                    id="rentMonthly"
                    value={formData.rentMonthly}
                    onChange={(e) => handleChange('rentMonthly', e.target.value)}
                    placeholder="0"
                    min="0"
                    step="100"
                    className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="taxesAnnual" className="block text-sm font-medium text-gray-700 mb-2">
                  Annual Taxes
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-500">$</span>
                  <input
                    type="number"
                    id="taxesAnnual"
                    value={formData.taxesAnnual}
                    onChange={(e) => handleChange('taxesAnnual', e.target.value)}
                    placeholder="0"
                    min="0"
                    step="100"
                    className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="insuranceAnnual" className="block text-sm font-medium text-gray-700 mb-2">
                  Annual Insurance
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-500">$</span>
                  <input
                    type="number"
                    id="insuranceAnnual"
                    value={formData.insuranceAnnual}
                    onChange={(e) => handleChange('insuranceAnnual', e.target.value)}
                    placeholder="0"
                    min="0"
                    step="100"
                    className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="interestRate" className="block text-sm font-medium text-gray-700 mb-2">
                  Interest Rate (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    id="interestRate"
                    value={formData.interestRate}
                    onChange={(e) => handleChange('interestRate', e.target.value)}
                    placeholder="7.0"
                    min="0"
                    max="100"
                    step="0.1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={loading}
                  />
                  <span className="absolute right-3 top-2 text-gray-500">%</span>
                </div>
              </div>

              <div>
                <label htmlFor="downPaymentPct" className="block text-sm font-medium text-gray-700 mb-2">
                  Down Payment (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    id="downPaymentPct"
                    value={formData.downPaymentPct}
                    onChange={(e) => handleChange('downPaymentPct', e.target.value)}
                    placeholder="20"
                    min="0"
                    max="100"
                    step="1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={loading}
                  />
                  <span className="absolute right-3 top-2 text-gray-500">%</span>
                </div>
              </div>

              <div>
                <label htmlFor="termYears" className="block text-sm font-medium text-gray-700 mb-2">
                  Loan Term (Years)
                </label>
                <input
                  type="number"
                  id="termYears"
                  value={formData.termYears}
                  onChange={(e) => handleChange('termYears', e.target.value)}
                  placeholder="30"
                  min="1"
                  max="50"
                  step="1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={loading}
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {loading ? 'Creating...' : 'Create Deal'}
            </button>
          </form>
        </div>

        <div>
          <Link
            href="/dashboard"
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
