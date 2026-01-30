import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserId, checkAndIncrementImportCount, getUserIdFromApiKey, getUserIdFromToken } from '@/lib/auth'
import { apiErrorResponse } from '@/lib/api-error'
import { checkRateLimit, getClientIdentifier } from '@/lib/rate-limit'
import { dealRepository, importLogRepository } from '@/lib/repositories'
import { supabaseDealRepository, fromDbDeal } from '@/lib/repositories/supabase-deal-repository'
import { supabaseImportLogRepository } from '@/lib/repositories/supabase-import-log-repository'
import { createAdminClient } from '@/lib/supabase/server'
import { extensionImportSchema } from '@/lib/schemas'
import { Deal, ImportStatus } from '@/lib/types'

const IMPORT_RATE_LIMIT = 30
const IMPORT_RATE_WINDOW_MS = 60_000

function shouldUseSupabase(): boolean {
  if (process.env.NODE_ENV === 'production') return true
  return process.env.USE_SUPABASE === 'true'
}

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
    
    // When auth is Bearer token (extension), there is no cookie session so RLS blocks inserts.
    // Use service-role client to create/update deal and import log (user already validated).
    const authViaBearer = !!authHeader?.startsWith('Bearer ')
    const useAdminForImport = authViaBearer && shouldUseSupabase()

    let existingDeal: Deal | null
    if (useAdminForImport) {
      const admin = createAdminClient()
      const { data: existingRow } = await admin.from('deals').select('*').eq('zillow_url', validated.zillowUrl).eq('user_id', userId).single()
      existingDeal = existingRow ? fromDbDeal(existingRow) : null
    } else {
      existingDeal = await dealRepository.findByZillowUrl(validated.zillowUrl, userId)
    }

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
    
    let dealId: string
    if (useAdminForImport) {
      const admin = createAdminClient()
      const deal = existingDeal
        ? await supabaseDealRepository.updateWithClient(admin, existingDeal.id, userId, dealData)
        : await supabaseDealRepository.createWithClient(admin, {
            ...dealData,
            userId,
          } as Omit<Deal, 'id' | 'createdAt' | 'updatedAt'>)
      dealId = deal?.id ?? ''
      if (!dealId) {
        console.error('[import] Deal missing id after create/update', { deal })
        return NextResponse.json(
          { error: 'Server error: deal not created', step: 'after_save' },
          { status: 500 }
        )
      }
      await supabaseImportLogRepository.createWithClient(admin, {
        dealId,
        zillowUrl: validated.zillowUrl,
        result: importStatus === 'success' ? 'success' : importStatus === 'partial' ? 'partial' : 'fail',
        missingFieldsCount: validated.missingFields.length,
        extractorVersion: validated.extractorVersion,
      })
    } else {
      const deal = existingDeal
        ? await dealRepository.update(existingDeal.id, userId, dealData)
        : await dealRepository.create({
            ...dealData,
            userId,
          } as Omit<Deal, 'id' | 'createdAt' | 'updatedAt'>)
      dealId = deal?.id ?? ''
      if (!dealId) {
        console.error('[import] Deal missing id after create/update', { deal })
        return NextResponse.json(
          { error: 'Server error: deal not created', step: 'after_save' },
          { status: 500 }
        )
      }
      await importLogRepository.create({
        dealId,
        zillowUrl: validated.zillowUrl,
        result: importStatus === 'success' ? 'success' : importStatus === 'partial' ? 'partial' : 'fail',
        missingFieldsCount: validated.missingFields.length,
        extractorVersion: validated.extractorVersion,
      })
    }

    return NextResponse.json({
      dealId,
      importsRemaining: remaining,
    }, { status: 201 })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return apiErrorResponse('Unauthorized', 401, { step: debugStep, details: error.message })
    }
    if (error.message === 'Invalid or expired token') {
      return apiErrorResponse('Invalid or expired token', 401, { step: debugStep, details: error.message })
    }
    if (error.message === 'Profile not found') {
      return apiErrorResponse('Profile not found - please complete account setup', 404, { step: debugStep })
    }
    if (error.name === 'ZodError') {
      return apiErrorResponse('Validation error', 400, { step: debugStep, details: error.errors })
    }
    return apiErrorResponse('An error occurred. Please try again.', 500, {
      step: debugStep,
      type: error.name || 'Error',
      details: error.message,
    })
  }
}
