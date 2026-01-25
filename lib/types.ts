export type ImportStatus = 'success' | 'partial' | 'fail' | 'manual'
export type FieldSource = 'imported' | 'assumed' | 'missing'
export type ExtractorVersion = 'structured_v1' | 'semantic_v1' | 'regex_v1'
export type PurchaseType = 'primary_residence' | 'investment_property' | 'house_hack' | 'vacation_home' | 'other'

export interface Deal {
  id: string
  userId: string
  createdAt: string
  updatedAt: string
  
  // Zillow data
  zillowUrl: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  propertyType: string | null
  beds: number | null
  baths: number | null
  sqft: number | null
  yearBuilt: number | null
  listPrice: number | null
  hoaMonthly: number | null
  taxesAnnual: number | null
  
  // Import metadata
  importStatus: ImportStatus
  importedFields: string[]
  missingFields: string[]
  fieldConfidences: Record<string, number> // Confidence scores (0-1) for imported fields
  assumedFields: string[] // Fields that were prefilled with defaults/assumptions
  
  // Deal inputs
  purchaseType: PurchaseType | null
  purchasePrice: number | null
  closingCostRate: number | null
  rehabCost: number | null
  
  // Loan inputs
  downPaymentPct: number | null
  interestRate: number | null
  termYears: number | null
  pmiEnabled: boolean
  pmiMonthly: number | null
  
  // Monthly costs (taxesAnnual and hoaMonthly are in Zillow data above)
  insuranceAnnual: number | null
  utilitiesMonthly: number | null
  
  // Income
  rentMonthly: number | null
  otherIncomeMonthly: number | null
  
  // Multi-family properties
  numberOfUnits: number | null
  rentPerUnit: number | null // Per unit monthly rent
  vacancyRatePerUnit: number | null // Per unit vacancy rate (if different)
  
  // Assumptions
  vacancyRate: number | null
  maintenanceRate: number | null
  capexRate: number | null
  managementRate: number | null
  
  // Holding period projections
  holdingPeriodYears: number | null
  appreciationRate: number | null
  rentGrowthRate: number | null
  expenseGrowthRate: number | null
  sellingCostRate: number | null
  
  notes: string | null
}

export interface UnderwritingInputs {
  purchasePrice: number
  closingCostRate: number
  rehabCost: number
  downPaymentPct: number
  interestRate: number
  termYears: number
  pmiEnabled: boolean
  pmiMonthly: number
  taxesAnnual: number
  insuranceAnnual: number
  hoaMonthly: number
  utilitiesMonthly: number
  rentMonthly: number
  otherIncomeMonthly: number
  vacancyRate: number
  maintenanceRate: number
  capexRate: number
  managementRate: number
}

export interface UnderwritingOutputs {
  totalMonthlyPayment: number
  noiMonthly: number
  noiAnnual: number
  cashFlowMonthly: number
  cashFlowAnnual: number
  capRate: number
  cashOnCash: number
  dscr: number
  breakEvenRentMonthly: number
  allInCashRequired: number
}

export interface Analysis {
  id: string
  dealId: string
  userId: string
  createdAt: string
  inputs: UnderwritingInputs
  outputs: UnderwritingOutputs
  holdingPeriodOutputs?: HoldingPeriodOutputs
  assumptionsSnapshot: Record<string, any>
  version: string
}

export interface ShareLink {
  token: string
  dealId: string
  userId: string
  createdAt: string
  revoked: boolean
}

export interface ImportLog {
  id: string
  dealId: string
  createdAt: string
  zillowUrl: string
  result: 'success' | 'partial' | 'fail'
  missingFieldsCount: number
  extractorVersion: ExtractorVersion
}

export interface ExtensionImportPayload {
  zillowUrl: string
  extractedData: {
    address?: string
    city?: string
    state?: string
    zip?: string
    propertyType?: string
    beds?: number
    baths?: number
    sqft?: number
    yearBuilt?: number
    listPrice?: number
    hoaMonthly?: number
    taxesAnnual?: number
  }
  importedFields: string[]
  missingFields: string[]
  fieldConfidences: Record<string, number>
  extractorVersion: ExtractorVersion
}

// Holding Period Analysis Types

export interface HoldingPeriodInputs {
  // Base underwriting inputs
  underwritingInputs: UnderwritingInputs
  // Projection parameters
  holdingPeriodYears: number
  appreciationRate: number // Annual property appreciation %
  rentGrowthRate: number // Annual rent growth %
  expenseGrowthRate: number // Annual expense growth %
  sellingCostRate: number // Selling costs as % of sale price
}

export interface YearlyProjection {
  year: number
  // Property
  propertyValue: number
  loanBalance: number
  equity: number
  // Income
  rentAnnual: number
  otherIncomeAnnual: number
  grossIncomeAnnual: number
  // Expenses
  vacancyLossAnnual: number
  operatingExpensesAnnual: number
  noiAnnual: number
  // Debt
  debtServiceAnnual: number
  principalPaidAnnual: number
  interestPaidAnnual: number
  // Cash flow
  cashFlowAnnual: number
  cumulativeCashFlow: number
}

export interface ExitScenario {
  salePrice: number
  sellingCosts: number
  loanPayoff: number
  netProceedsFromSale: number
  cumulativeCashFlow: number
  totalProfit: number
  initialInvestment: number
  totalROI: number // (Total Profit / Initial Investment) * 100
  annualizedROI: number // Geometric mean
}

export interface HoldingPeriodOutputs {
  yearlyProjections: YearlyProjection[]
  exitScenario: ExitScenario
  irr: number // Internal Rate of Return
  equityMultiple: number // Total return / Initial investment
}
