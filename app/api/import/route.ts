import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserId, checkAndIncrementImportCount, getUserIdFromApiKey, getUserIdFromToken } from '@/lib/auth'
import { dealRepository, importLogRepository } from '@/lib/repositories'
import { extensionImportSchema } from '@/lib/schemas'
import { Deal, ImportStatus } from '@/lib/types'

// POST /api/import - Accept extension payload
export async function POST(request: NextRequest) {
  let debugStep = 'init'
  
  try {
    debugStep = 'checking_auth_header'
    // Try to get user from Bearer token (API key or JWT), then fall back to session
    const authHeader = request.headers.get('authorization')
    let userId: string
    
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      debugStep = 'validating_token'
      
      // Check if it's an API key (starts with dm_) or a JWT token
      if (token.startsWith('dm_')) {
        debugStep = 'validating_api_key'
        userId = await getUserIdFromApiKey(token)
      } else {
        // Assume it's a JWT token from extension auth
        debugStep = 'validating_jwt_token'
        userId = await getUserIdFromToken(token)
      }
    } else {
      debugStep = 'getting_session_user'
      userId = await getCurrentUserId()
    }
    
    debugStep = 'checking_import_limits'
    // Check import limits for free tier
    const { allowed, remaining } = await checkAndIncrementImportCount(userId)
    if (!allowed) {
      return NextResponse.json(
        { 
          error: 'Import limit reached',
          message: 'You have reached your monthly limit of 2 extension imports. Upgrade to Pro for unlimited imports.',
          upgradeUrl: '/pricing'
        },
        { status: 403 }
      )
    }
    
    const body = await request.json()
    
    // Log the incoming payload for debugging
    console.log('Received import payload:', JSON.stringify(body, null, 2))
    
    const validated = extensionImportSchema.parse(body)
    
    // Determine import status
    let importStatus: ImportStatus = 'fail'
    if (validated.importedFields.length >= 4) {
      importStatus = 'success'
    } else if (validated.importedFields.length >= 2) {
      importStatus = 'partial'
    }
    
    // Create or update deal
    const existingDeal = await dealRepository.findByZillowUrl(validated.zillowUrl, userId)
    
    // Calculate assumed values based on property value
    const propertyValue = validated.extractedData.listPrice || 0
    
    // Insurance: typically 0.35% of property value annually
    const estimatedInsurance = propertyValue > 0 ? Math.round(propertyValue * 0.0035) : null
    
    // Rent: typically 0.8% of property value monthly (1% rule approximation)
    // BUT: If Primary Residence, rent should be 0
    const estimatedRent = validated.purchaseType === 'primary_residence' 
      ? 0 
      : (propertyValue > 0 ? Math.round(propertyValue * 0.008) : null)
    
    // Taxes: typically 1.2% of property value annually (varies by area)
    const estimatedTaxes = propertyValue > 0 ? Math.round(propertyValue * 0.012) : null
    
    // Identify assumed fields (prefilled defaults)
    const assumedFields: string[] = []
    
    // Fields that are always assumed (defaults)
    assumedFields.push('closingCostRate', 'downPaymentPct', 'interestRate', 'termYears', 'maintenanceRate', 'capexRate')
    
    // For primary residences, vacancy and management should be 0
    const vacancyRate = validated.purchaseType === 'primary_residence' ? 0 : 5.0
    const managementRate = validated.purchaseType === 'primary_residence' ? 0 : 8.0
    
    if (validated.purchaseType === 'primary_residence') {
      assumedFields.push('vacancyRate', 'managementRate')
    } else {
      assumedFields.push('vacancyRate', 'managementRate')
    }
    
    // Add assumed fields for values we're estimating
    if (!validated.extractedData.taxesAnnual && estimatedTaxes) {
      assumedFields.push('taxesAnnual')
    }
    if (!validated.extractedData.listPrice) {
      // purchasePrice will be null if no listPrice
    } else {
      // purchasePrice defaults to listPrice, but that's imported, not assumed
    }
    if (estimatedInsurance) {
      assumedFields.push('insuranceAnnual')
    }
    if (estimatedRent) {
      assumedFields.push('rentMonthly')
    }
    assumedFields.push('rehabCost') // Always $0
    
    const dealData: Partial<Deal> = {
      zillowUrl: validated.zillowUrl,
      address: validated.extractedData.address || null,
      city: validated.extractedData.city || null,
      state: validated.extractedData.state || null,
      zip: validated.extractedData.zip || null,
      propertyType: validated.extractedData.propertyType || null,
      beds: validated.extractedData.beds || null,
      baths: validated.extractedData.baths || null,
      sqft: validated.extractedData.sqft || null,
      yearBuilt: validated.extractedData.yearBuilt || null,
      listPrice: validated.extractedData.listPrice || null,
      hoaMonthly: validated.extractedData.hoaMonthly || null,
      taxesAnnual: validated.extractedData.taxesAnnual || estimatedTaxes,
      importStatus,
      importedFields: validated.importedFields,
      missingFields: validated.missingFields,
      fieldConfidences: validated.fieldConfidences || {},
      assumedFields: assumedFields,
      purchaseType: validated.purchaseType,
      purchasePrice: validated.extractedData.listPrice || null,
      closingCostRate: 3.0,
      rehabCost: 0, // Always assume $0 rehab
      downPaymentPct: validated.downPaymentPct,
      interestRate: 7.0,
      termYears: 30,
      pmiEnabled: false,
      pmiMonthly: null,
      insuranceAnnual: estimatedInsurance,
      utilitiesMonthly: null,
      rentMonthly: estimatedRent,
      otherIncomeMonthly: null,
      numberOfUnits: null, // Will be set by user if multi-family
      rentPerUnit: null,
      vacancyRatePerUnit: null,
      vacancyRate: vacancyRate,
      maintenanceRate: 8.0,
      capexRate: 5.0,
      managementRate: managementRate,
      holdingPeriodYears: null,
      appreciationRate: null,
      rentGrowthRate: null,
      expenseGrowthRate: null,
      sellingCostRate: null,
      notes: null,
    }
    
    let deal: Deal
    if (existingDeal) {
      deal = await dealRepository.update(existingDeal.id, userId, dealData)
    } else {
      deal = await dealRepository.create({
        ...dealData,
        userId,
      } as Omit<Deal, 'id' | 'createdAt' | 'updatedAt'>)
    }
    
    // Log import
    await importLogRepository.create({
      dealId: deal.id,
      zillowUrl: validated.zillowUrl,
      result: importStatus === 'success' ? 'success' : importStatus === 'partial' ? 'partial' : 'fail',
      missingFieldsCount: validated.missingFields.length,
      extractorVersion: validated.extractorVersion,
    })
    
    return NextResponse.json({ 
      dealId: deal.id,
      importsRemaining: remaining 
    }, { status: 201 })
  } catch (error: any) {
    console.error('Error importing deal at step:', debugStep, error)
    
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized', step: debugStep }, { status: 401 })
    }
    if (error.message === 'Invalid or expired token') {
      return NextResponse.json({ error: 'Invalid or expired token', step: debugStep }, { status: 401 })
    }
    if (error.message === 'Profile not found') {
      return NextResponse.json({ error: 'Profile not found - please complete account setup', step: debugStep }, { status: 404 })
    }
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors, step: debugStep },
        { status: 400 }
      )
    }
    
    // Always return detailed error info for debugging
    return NextResponse.json(
      { 
        error: error.message || 'Failed to import deal',
        step: debugStep,
        type: error.name || 'Error'
      },
      { status: 500 }
    )
  }
}
