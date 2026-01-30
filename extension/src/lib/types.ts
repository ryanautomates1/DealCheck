// Types for underwriting calculations (subset of main app types)

export type PurchaseType = 'primary_residence' | 'investment_property' | 'house_hack' | 'vacation_home' | 'other'

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

export interface HoldingPeriodInputs {
  underwritingInputs: UnderwritingInputs
  holdingPeriodYears: number
  appreciationRate: number
  rentGrowthRate: number
  expenseGrowthRate: number
  sellingCostRate: number
}

export interface YearlyProjection {
  year: number
  propertyValue: number
  loanBalance: number
  equity: number
  rentAnnual: number
  otherIncomeAnnual: number
  grossIncomeAnnual: number
  vacancyLossAnnual: number
  operatingExpensesAnnual: number
  noiAnnual: number
  debtServiceAnnual: number
  principalPaidAnnual: number
  interestPaidAnnual: number
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
  totalROI: number
  annualizedROI: number
}

export interface HoldingPeriodOutputs {
  yearlyProjections: YearlyProjection[]
  exitScenario: ExitScenario
  irr: number
  equityMultiple: number
}

export interface PrimaryResidenceOutputs {
  allInMonthlyCost: number
  mortgagePI: number
  monthlyTaxes: number
  monthlyInsurance: number
  monthlyHOA: number
  monthlyMaintenanceReserve: number
  cashRequiredAtClose: number
  monthlyCostVsRent?: number
  annualGrossCost: number
  annualPrincipalPaydown: number
  annualNetCostOfOwnership: number
}

// Scraped data from Zillow page
export interface ScrapedPropertyData {
  address?: string
  city?: string
  state?: string
  zip?: string
  listPrice?: number
  beds?: number
  baths?: number
  sqft?: number
  propertyType?: string
  yearBuilt?: number
  hoaMonthly?: number
  taxesAnnual?: number
  taxYear?: number  // Year the tax data is from (if pulled from tax history)
  taxSource?: 'actual' | 'estimated'  // Whether taxes are from actual records or estimated
  zillowUrl?: string
}

// User-editable assumptions in sidebar
export interface UserAssumptions {
  purchaseType: PurchaseType
  downPaymentPct: number
  interestRate: number
  termYears: number
  closingCostRate: number
  // Advanced (collapsed by default)
  maintenanceRate: number
  capexRate: number
  vacancyRate: number
  managementRate: number
  // Estimated rent for primary residence comparison
  estimatedRent: number
}

// Default assumptions
export const DEFAULT_ASSUMPTIONS: UserAssumptions = {
  purchaseType: 'primary_residence',
  downPaymentPct: 20,
  interestRate: 7.0,
  termYears: 30,
  closingCostRate: 3,
  maintenanceRate: 0.5,  // For primary residence
  capexRate: 0.5,        // For primary residence
  vacancyRate: 0,
  managementRate: 0,
  estimatedRent: 0,
}

// Investment property defaults
export const INVESTMENT_ASSUMPTIONS: Partial<UserAssumptions> = {
  maintenanceRate: 8,
  capexRate: 5,
  vacancyRate: 5,
  managementRate: 8,
}
