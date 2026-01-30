import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserId } from '@/lib/auth'
import { apiErrorResponse } from '@/lib/api-error'
import { dealRepository } from '@/lib/repositories'
import { createDealSchema } from '@/lib/schemas'
import { Deal } from '@/lib/types'

// GET /api/deals - List all deals
export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q')
    
    const deals = query 
      ? await dealRepository.search(userId, query)
      : await dealRepository.findAll(userId)
    
    return NextResponse.json({ deals })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return apiErrorResponse('Something went wrong', 500, {
      type: error?.name,
      details: error?.message,
    })
  }
}

// POST /api/deals - Create manual deal
export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    const body = await request.json()
    
    const validated = createDealSchema.parse(body)
    
    // Calculate assumed values based on purchase price
    const propertyValue = validated.purchasePrice || 0
    
    // Insurance: typically 0.35% of property value annually
    const estimatedInsurance = propertyValue > 0 ? Math.round(propertyValue * 0.0035) : null
    
    // Rent: typically 0.8% of property value monthly (1% rule approximation)
    const estimatedRent = propertyValue > 0 ? Math.round(propertyValue * 0.008) : null
    
    // Taxes: typically 1.2% of property value annually (varies by area)
    const estimatedTaxes = propertyValue > 0 ? Math.round(propertyValue * 0.012) : null
    
    // Identify assumed fields
    const assumedFields: string[] = ['closingCostRate', 'downPaymentPct', 'interestRate', 'termYears', 'vacancyRate', 'maintenanceRate', 'capexRate', 'managementRate', 'rehabCost']
    
    if (!validated.taxesAnnual && estimatedTaxes) {
      assumedFields.push('taxesAnnual')
    }
    if (!validated.insuranceAnnual && estimatedInsurance) {
      assumedFields.push('insuranceAnnual')
    }
    if (!validated.rentMonthly && estimatedRent) {
      assumedFields.push('rentMonthly')
    }
    
    const newDeal: Omit<Deal, 'id' | 'createdAt' | 'updatedAt'> = {
      userId,
      zillowUrl: null,
      address: validated.address || null,
      city: null,
      state: null,
      zip: null,
      propertyType: null,
      beds: null,
      baths: null,
      sqft: null,
      yearBuilt: null,
      listPrice: null,
      hoaMonthly: null,
      taxesAnnual: validated.taxesAnnual || estimatedTaxes,
      importStatus: 'manual',
      importedFields: [],
      missingFields: [],
      fieldConfidences: {},
      assumedFields,
      purchaseType: null, // Manual deals don't have purchase type initially
      purchasePrice: validated.purchasePrice || null,
      closingCostRate: 3.0,
      rehabCost: 0, // Always assume $0 rehab
      downPaymentPct: validated.downPaymentPct || 20.0,
      interestRate: validated.interestRate || 7.0,
      termYears: validated.termYears || 30,
      pmiEnabled: false,
      pmiMonthly: null,
      insuranceAnnual: validated.insuranceAnnual || estimatedInsurance,
      utilitiesMonthly: null,
      rentMonthly: validated.rentMonthly || estimatedRent,
      otherIncomeMonthly: null,
      numberOfUnits: null,
      rentPerUnit: null,
      vacancyRatePerUnit: null,
      vacancyRate: 5.0,
      maintenanceRate: 8.0,
      capexRate: 5.0,
      managementRate: 8.0,
      holdingPeriodYears: null,
      appreciationRate: null,
      rentGrowthRate: null,
      expenseGrowthRate: null,
      sellingCostRate: null,
      notes: null,
    }
    
    const deal = await dealRepository.create(newDeal)
    return NextResponse.json({ deal }, { status: 201 })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error.name === 'ZodError') {
      return apiErrorResponse('Validation error', 400, { details: error.errors })
    }
    return apiErrorResponse('Something went wrong', 500, {
      type: error.name,
      details: error.message,
    })
  }
}
