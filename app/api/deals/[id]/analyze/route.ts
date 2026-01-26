import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserId } from '@/lib/auth'
import { dealRepository, analysisRepository } from '@/lib/repositories'
import { analyzeDealSchema } from '@/lib/schemas'
import { 
  calculateUnderwriting, 
  calculateHoldingPeriodAnalysis,
  calculatePrimaryResidenceAnalysis,
  calculatePrimaryResidenceHoldingPeriod
} from '@/lib/underwriting/engine'
import { 
  UnderwritingInputs, 
  HoldingPeriodInputs, 
  HoldingPeriodOutputs,
  PrimaryResidenceOutputs,
  PrimaryResidenceHoldingPeriodOutputs
} from '@/lib/types'

// POST /api/deals/[id]/analyze
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getCurrentUserId()
    const body = await request.json()
    
    // Verify deal exists
    const deal = await dealRepository.findById(params.id, userId)
    if (!deal) {
      return NextResponse.json(
        { error: 'Deal not found' },
        { status: 404 }
      )
    }
    
    // Validate inputs
    const validated = analyzeDealSchema.parse(body)
    
    // Prepare inputs
    const inputs: UnderwritingInputs = {
      purchasePrice: validated.purchasePrice,
      closingCostRate: validated.closingCostRate,
      rehabCost: validated.rehabCost,
      downPaymentPct: validated.downPaymentPct,
      interestRate: validated.interestRate,
      termYears: validated.termYears,
      pmiEnabled: validated.pmiEnabled,
      pmiMonthly: validated.pmiMonthly,
      taxesAnnual: validated.taxesAnnual,
      insuranceAnnual: validated.insuranceAnnual,
      hoaMonthly: validated.hoaMonthly,
      utilitiesMonthly: validated.utilitiesMonthly,
      rentMonthly: validated.rentMonthly,
      otherIncomeMonthly: validated.otherIncomeMonthly,
      vacancyRate: validated.vacancyRate,
      maintenanceRate: validated.maintenanceRate,
      capexRate: validated.capexRate,
      managementRate: validated.managementRate,
    }
    
    // Calculate outputs
    const outputs = calculateUnderwriting(inputs)
    
    // Calculate holding period analysis for all property types
    let holdingPeriodAnalysis: HoldingPeriodOutputs | null = null
    
    // Calculate primary residence specific outputs
    let primaryResidenceOutputs: PrimaryResidenceOutputs | null = null
    let primaryResidenceHoldingPeriod: PrimaryResidenceHoldingPeriodOutputs | null = null
    const isPrimaryResidence = deal.purchaseType === 'primary_residence'
    
    if (isPrimaryResidence) {
      primaryResidenceOutputs = calculatePrimaryResidenceAnalysis(inputs)
    }
    
    if (validated.holdingPeriodYears) {
      const holdingPeriodInputs: HoldingPeriodInputs = {
        underwritingInputs: inputs,
        holdingPeriodYears: validated.holdingPeriodYears || 10,
        appreciationRate: validated.appreciationRate ?? 3,
        rentGrowthRate: validated.rentGrowthRate ?? 2,
        expenseGrowthRate: validated.expenseGrowthRate ?? 2,
        sellingCostRate: validated.sellingCostRate ?? 6,
      }
      
      holdingPeriodAnalysis = calculateHoldingPeriodAnalysis(holdingPeriodInputs)
      
      // Calculate primary residence holding period analysis
      if (isPrimaryResidence) {
        // Use market rent equivalent if provided, otherwise estimate from property value
        const marketRentMonthly = deal.rentMonthly || (inputs.purchasePrice * 0.005) // ~0.5% of value as rough estimate
        primaryResidenceHoldingPeriod = calculatePrimaryResidenceHoldingPeriod(holdingPeriodInputs, marketRentMonthly)
      }
    }
    
    // Create analysis (include holding period outputs if calculated)
    const analysis = await analysisRepository.create({
      dealId: params.id,
      userId,
      inputs,
      outputs,
      holdingPeriodOutputs: holdingPeriodAnalysis || undefined,
      assumptionsSnapshot: {
        ...inputs,
        holdingPeriodYears: validated.holdingPeriodYears,
        appreciationRate: validated.appreciationRate,
        rentGrowthRate: validated.rentGrowthRate,
        expenseGrowthRate: validated.expenseGrowthRate,
        sellingCostRate: validated.sellingCostRate,
        calculatedAt: new Date().toISOString(),
      },
      version: 'v1',
    })
    
    return NextResponse.json({ 
      analysis,
      holdingPeriodAnalysis,
      primaryResidenceOutputs,
      primaryResidenceHoldingPeriod,
    }, { status: 201 })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error analyzing deal:', error)
    return NextResponse.json(
      { error: 'Failed to analyze deal' },
      { status: 500 }
    )
  }
}
