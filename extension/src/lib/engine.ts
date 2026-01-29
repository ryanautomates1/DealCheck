/**
 * Underwriting calculation engine for Chrome extension
 * Pure TypeScript - no external dependencies
 */

import { 
  UnderwritingInputs, 
  UnderwritingOutputs, 
  HoldingPeriodInputs,
  HoldingPeriodOutputs,
  YearlyProjection,
  ExitScenario,
  PrimaryResidenceOutputs
} from './types'

/**
 * Calculate monthly principal and interest payment
 */
export function calculateMonthlyPI(
  principal: number,
  annualRate: number,
  termYears: number
): number {
  if (principal === 0 || termYears === 0) return 0
  
  const monthlyRate = annualRate / 100 / 12
  const numPayments = termYears * 12
  
  if (monthlyRate === 0) {
    return principal / numPayments
  }
  
  const monthlyPayment =
    (principal * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
    (Math.pow(1 + monthlyRate, numPayments) - 1)
  
  return monthlyPayment
}

/**
 * Calculate total monthly payment (P&I + PMI + taxes + insurance + HOA + utilities)
 */
export function calculateTotalMonthlyPayment(inputs: UnderwritingInputs): number {
  const loanAmount = inputs.purchasePrice * (1 - inputs.downPaymentPct / 100)
  const monthlyPI = calculateMonthlyPI(loanAmount, inputs.interestRate, inputs.termYears)
  const monthlyTaxes = inputs.taxesAnnual / 12
  const monthlyInsurance = inputs.insuranceAnnual / 12
  const pmi = inputs.pmiEnabled ? (inputs.pmiMonthly || 0) : 0
  
  return monthlyPI + pmi + monthlyTaxes + monthlyInsurance + inputs.hoaMonthly + inputs.utilitiesMonthly
}

/**
 * Calculate Net Operating Income (NOI)
 */
export function calculateNOI(inputs: UnderwritingInputs): { monthly: number; annual: number } {
  const grossIncomeMonthly = inputs.rentMonthly + inputs.otherIncomeMonthly
  const vacancyLossMonthly = grossIncomeMonthly * (inputs.vacancyRate / 100)
  const effectiveIncomeMonthly = grossIncomeMonthly - vacancyLossMonthly
  
  const isPrimaryResidence = inputs.rentMonthly === 0 && inputs.managementRate === 0
  const expenseBase = isPrimaryResidence 
    ? inputs.purchasePrice / 100
    : grossIncomeMonthly
  
  const maintenanceMonthly = expenseBase * (inputs.maintenanceRate / 100)
  const capexMonthly = expenseBase * (inputs.capexRate / 100)
  const managementMonthly = grossIncomeMonthly * (inputs.managementRate / 100)
  
  const operatingExpensesMonthly =
    maintenanceMonthly + 
    capexMonthly + 
    managementMonthly + 
    inputs.taxesAnnual / 12 + 
    inputs.insuranceAnnual / 12 + 
    inputs.hoaMonthly + 
    inputs.utilitiesMonthly
  
  const noiMonthly = effectiveIncomeMonthly - operatingExpensesMonthly
  const noiAnnual = noiMonthly * 12
  
  return { monthly: noiMonthly, annual: noiAnnual }
}

/**
 * Calculate debt service (P&I + PMI only)
 */
export function calculateDebtService(inputs: UnderwritingInputs): { monthly: number; annual: number } {
  const loanAmount = inputs.purchasePrice * (1 - inputs.downPaymentPct / 100)
  const monthlyPI = calculateMonthlyPI(loanAmount, inputs.interestRate, inputs.termYears)
  const pmi = inputs.pmiEnabled ? (inputs.pmiMonthly || 0) : 0
  
  const monthly = monthlyPI + pmi
  return { monthly, annual: monthly * 12 }
}

/**
 * Calculate cash flow
 */
export function calculateCashFlow(inputs: UnderwritingInputs): { monthly: number; annual: number } {
  const noi = calculateNOI(inputs)
  const debtService = calculateDebtService(inputs)
  
  const cashFlowMonthly = noi.monthly - debtService.monthly
  const cashFlowAnnual = cashFlowMonthly * 12
  
  return { monthly: cashFlowMonthly, annual: cashFlowAnnual }
}

/**
 * Calculate Cap Rate
 */
export function calculateCapRate(inputs: UnderwritingInputs): number {
  const noi = calculateNOI(inputs)
  if (inputs.purchasePrice === 0) return 0
  return (noi.annual / inputs.purchasePrice) * 100
}

/**
 * Calculate Cash-on-Cash Return
 */
export function calculateCashOnCash(inputs: UnderwritingInputs): number {
  const cashFlow = calculateCashFlow(inputs)
  const allInCash = calculateAllInCashRequired(inputs)
  if (allInCash === 0) return 0
  return (cashFlow.annual / allInCash) * 100
}

/**
 * Calculate Debt Service Coverage Ratio (DSCR)
 */
export function calculateDSCR(inputs: UnderwritingInputs): number {
  const noi = calculateNOI(inputs)
  const debtService = calculateDebtService(inputs)
  
  if (debtService.annual === 0) return 0
  return noi.annual / debtService.annual
}

/**
 * Calculate break-even rent
 */
export function calculateBreakEvenRent(inputs: UnderwritingInputs): number {
  const debtService = calculateDebtService(inputs)
  
  const fixedExpensesMonthly =
    inputs.taxesAnnual / 12 +
    inputs.insuranceAnnual / 12 +
    inputs.hoaMonthly +
    inputs.utilitiesMonthly
  
  const vacancyRate = inputs.vacancyRate / 100
  const maintenanceRate = inputs.maintenanceRate / 100
  const capexRate = inputs.capexRate / 100
  const managementRate = inputs.managementRate / 100
  
  const denominator = 1 - vacancyRate - maintenanceRate - capexRate - managementRate
  
  if (denominator <= 0) {
    return debtService.monthly + fixedExpensesMonthly
  }
  
  const breakEvenRent = (debtService.monthly + fixedExpensesMonthly - inputs.otherIncomeMonthly) / denominator
  
  return Math.max(0, breakEvenRent)
}

/**
 * Calculate all-in cash required
 */
export function calculateAllInCashRequired(inputs: UnderwritingInputs): number {
  const downPayment = inputs.purchasePrice * (inputs.downPaymentPct / 100)
  const closingCosts = inputs.purchasePrice * (inputs.closingCostRate / 100)
  return downPayment + closingCosts + inputs.rehabCost
}

/**
 * Main underwriting calculation function
 */
export function calculateUnderwriting(inputs: UnderwritingInputs): UnderwritingOutputs {
  const totalMonthlyPayment = calculateTotalMonthlyPayment(inputs)
  const noi = calculateNOI(inputs)
  const cashFlow = calculateCashFlow(inputs)
  const capRate = calculateCapRate(inputs)
  const cashOnCash = calculateCashOnCash(inputs)
  const dscr = calculateDSCR(inputs)
  const breakEvenRentMonthly = calculateBreakEvenRent(inputs)
  const allInCashRequired = calculateAllInCashRequired(inputs)
  
  return {
    totalMonthlyPayment,
    noiMonthly: noi.monthly,
    noiAnnual: noi.annual,
    cashFlowMonthly: cashFlow.monthly,
    cashFlowAnnual: cashFlow.annual,
    capRate,
    cashOnCash,
    dscr,
    breakEvenRentMonthly,
    allInCashRequired,
  }
}

// =============================================================================
// HOLDING PERIOD ANALYSIS
// =============================================================================

export function getLoanBalanceAtYear(
  loanAmount: number,
  annualRate: number,
  termYears: number,
  year: number
): number {
  if (year <= 0) return loanAmount
  if (year >= termYears) return 0
  
  const monthlyRate = annualRate / 100 / 12
  const numPayments = termYears * 12
  const monthlyPayment = calculateMonthlyPI(loanAmount, annualRate, termYears)
  const paymentsMade = year * 12
  
  if (monthlyRate === 0) {
    return loanAmount - (monthlyPayment * paymentsMade)
  }
  
  const balance = loanAmount * 
    (Math.pow(1 + monthlyRate, numPayments) - Math.pow(1 + monthlyRate, paymentsMade)) /
    (Math.pow(1 + monthlyRate, numPayments) - 1)
  
  return Math.max(0, balance)
}

export function getPrincipalPaidInYear(
  loanAmount: number,
  annualRate: number,
  termYears: number,
  year: number
): number {
  const balanceStart = getLoanBalanceAtYear(loanAmount, annualRate, termYears, year - 1)
  const balanceEnd = getLoanBalanceAtYear(loanAmount, annualRate, termYears, year)
  return balanceStart - balanceEnd
}

export function getInterestPaidInYear(
  loanAmount: number,
  annualRate: number,
  termYears: number,
  year: number
): number {
  const monthlyPayment = calculateMonthlyPI(loanAmount, annualRate, termYears)
  const annualPayments = monthlyPayment * 12
  const principalPaid = getPrincipalPaidInYear(loanAmount, annualRate, termYears, year)
  return annualPayments - principalPaid
}

export function calculateYearlyProjection(
  inputs: HoldingPeriodInputs,
  year: number,
  previousCumulativeCashFlow: number = 0
): YearlyProjection {
  const { underwritingInputs, appreciationRate, rentGrowthRate, expenseGrowthRate } = inputs
  
  const loanAmount = underwritingInputs.purchasePrice * (1 - underwritingInputs.downPaymentPct / 100)
  const propertyValue = underwritingInputs.purchasePrice * Math.pow(1 + appreciationRate / 100, year)
  const loanBalance = getLoanBalanceAtYear(loanAmount, underwritingInputs.interestRate, underwritingInputs.termYears, year)
  const equity = propertyValue - loanBalance
  
  const rentGrowthFactor = Math.pow(1 + rentGrowthRate / 100, year - 1)
  const rentAnnual = underwritingInputs.rentMonthly * 12 * rentGrowthFactor
  const otherIncomeAnnual = underwritingInputs.otherIncomeMonthly * 12 * rentGrowthFactor
  const grossIncomeAnnual = rentAnnual + otherIncomeAnnual
  
  const vacancyLossAnnual = grossIncomeAnnual * (underwritingInputs.vacancyRate / 100)
  const effectiveIncomeAnnual = grossIncomeAnnual - vacancyLossAnnual
  
  const expenseGrowthFactor = Math.pow(1 + expenseGrowthRate / 100, year - 1)
  const taxesAnnual = underwritingInputs.taxesAnnual * expenseGrowthFactor
  const insuranceAnnual = underwritingInputs.insuranceAnnual * expenseGrowthFactor
  const hoaAnnual = underwritingInputs.hoaMonthly * 12 * expenseGrowthFactor
  const utilitiesAnnual = underwritingInputs.utilitiesMonthly * 12 * expenseGrowthFactor
  const maintenanceAnnual = grossIncomeAnnual * (underwritingInputs.maintenanceRate / 100)
  const capexAnnual = grossIncomeAnnual * (underwritingInputs.capexRate / 100)
  const managementAnnual = grossIncomeAnnual * (underwritingInputs.managementRate / 100)
  
  const operatingExpensesAnnual = 
    taxesAnnual + insuranceAnnual + hoaAnnual + utilitiesAnnual + 
    maintenanceAnnual + capexAnnual + managementAnnual
  
  const noiAnnual = effectiveIncomeAnnual - operatingExpensesAnnual
  
  const monthlyPI = calculateMonthlyPI(loanAmount, underwritingInputs.interestRate, underwritingInputs.termYears)
  const pmi = underwritingInputs.pmiEnabled ? (underwritingInputs.pmiMonthly || 0) : 0
  const debtServiceAnnual = (monthlyPI + pmi) * 12
  
  const principalPaidAnnual = getPrincipalPaidInYear(loanAmount, underwritingInputs.interestRate, underwritingInputs.termYears, year)
  const interestPaidAnnual = getInterestPaidInYear(loanAmount, underwritingInputs.interestRate, underwritingInputs.termYears, year)
  
  const cashFlowAnnual = noiAnnual - debtServiceAnnual
  const cumulativeCashFlow = previousCumulativeCashFlow + cashFlowAnnual
  
  return {
    year,
    propertyValue,
    loanBalance,
    equity,
    rentAnnual,
    otherIncomeAnnual,
    grossIncomeAnnual,
    vacancyLossAnnual,
    operatingExpensesAnnual,
    noiAnnual,
    debtServiceAnnual,
    principalPaidAnnual,
    interestPaidAnnual,
    cashFlowAnnual,
    cumulativeCashFlow,
  }
}

export function calculateHoldingPeriodProjection(inputs: HoldingPeriodInputs): YearlyProjection[] {
  const projections: YearlyProjection[] = []
  let cumulativeCashFlow = 0
  
  for (let year = 1; year <= inputs.holdingPeriodYears; year++) {
    const projection = calculateYearlyProjection(inputs, year, cumulativeCashFlow)
    projections.push(projection)
    cumulativeCashFlow = projection.cumulativeCashFlow
  }
  
  return projections
}

export function calculateIRR(cashFlows: number[], maxIterations: number = 100, tolerance: number = 0.0001): number {
  const npv = (rate: number): number => {
    return cashFlows.reduce((sum, cf, t) => sum + cf / Math.pow(1 + rate, t), 0)
  }
  
  const npvDerivative = (rate: number): number => {
    return cashFlows.reduce((sum, cf, t) => {
      if (t === 0) return sum
      return sum - (t * cf) / Math.pow(1 + rate, t + 1)
    }, 0)
  }
  
  let rate = 0.1
  
  for (let i = 0; i < maxIterations; i++) {
    const npvValue = npv(rate)
    const derivative = npvDerivative(rate)
    
    if (Math.abs(derivative) < 1e-10) break
    
    const newRate = rate - npvValue / derivative
    
    if (newRate < -0.99) rate = -0.99
    else if (newRate > 10) rate = 10
    else rate = newRate
    
    if (Math.abs(npvValue) < tolerance) return rate * 100
  }
  
  // Bisection fallback
  let lower = -0.99
  let upper = 10.0
  
  for (let i = 0; i < maxIterations; i++) {
    const mid = (lower + upper) / 2
    const npvMid = npv(mid)
    
    if (Math.abs(npvMid) < tolerance || (upper - lower) / 2 < tolerance) {
      return mid * 100
    }
    
    if (npv(lower) * npvMid < 0) upper = mid
    else lower = mid
  }
  
  return rate * 100
}

export function calculateExitScenario(
  inputs: HoldingPeriodInputs,
  projections: YearlyProjection[]
): ExitScenario {
  const lastYear = projections[projections.length - 1]
  const initialInvestment = calculateAllInCashRequired(inputs.underwritingInputs)
  
  const salePrice = lastYear.propertyValue
  const sellingCosts = salePrice * (inputs.sellingCostRate / 100)
  const loanPayoff = lastYear.loanBalance
  const netProceedsFromSale = salePrice - sellingCosts - loanPayoff
  const cumulativeCashFlow = lastYear.cumulativeCashFlow
  
  const totalProfit = netProceedsFromSale + cumulativeCashFlow - initialInvestment
  const totalROI = initialInvestment > 0 ? (totalProfit / initialInvestment) * 100 : 0
  
  const years = inputs.holdingPeriodYears
  const endingValue = initialInvestment + totalProfit
  const annualizedROI = initialInvestment > 0 && years > 0
    ? (Math.pow(endingValue / initialInvestment, 1 / years) - 1) * 100
    : 0
  
  return {
    salePrice,
    sellingCosts,
    loanPayoff,
    netProceedsFromSale,
    cumulativeCashFlow,
    totalProfit,
    initialInvestment,
    totalROI,
    annualizedROI,
  }
}

export function calculateHoldingPeriodAnalysis(inputs: HoldingPeriodInputs): HoldingPeriodOutputs {
  const yearlyProjections = calculateHoldingPeriodProjection(inputs)
  const exitScenario = calculateExitScenario(inputs, yearlyProjections)
  
  const initialInvestment = calculateAllInCashRequired(inputs.underwritingInputs)
  const cashFlows: number[] = [-initialInvestment]
  
  for (let i = 0; i < yearlyProjections.length; i++) {
    const projection = yearlyProjections[i]
    if (i === yearlyProjections.length - 1) {
      cashFlows.push(projection.cashFlowAnnual + exitScenario.netProceedsFromSale)
    } else {
      cashFlows.push(projection.cashFlowAnnual)
    }
  }
  
  const irr = calculateIRR(cashFlows)
  const totalReturns = exitScenario.cumulativeCashFlow + exitScenario.netProceedsFromSale
  const equityMultiple = initialInvestment > 0 ? totalReturns / initialInvestment : 0
  
  return {
    yearlyProjections,
    exitScenario,
    irr,
    equityMultiple,
  }
}

// =============================================================================
// PRIMARY RESIDENCE ANALYSIS
// =============================================================================

export function calculatePrimaryResidenceAnalysis(inputs: UnderwritingInputs): PrimaryResidenceOutputs {
  const loanAmount = inputs.purchasePrice * (1 - inputs.downPaymentPct / 100)
  
  const mortgagePI = calculateMonthlyPI(loanAmount, inputs.interestRate, inputs.termYears)
  const monthlyTaxes = inputs.taxesAnnual / 12
  const monthlyInsurance = inputs.insuranceAnnual / 12
  const monthlyHOA = inputs.hoaMonthly
  const pmi = inputs.pmiEnabled ? (inputs.pmiMonthly || 0) : 0
  
  const monthlyMaintenanceReserve = inputs.purchasePrice * (inputs.maintenanceRate / 100 / 12) +
                                     inputs.purchasePrice * (inputs.capexRate / 100 / 12)
  
  const allInMonthlyCost = mortgagePI + pmi + monthlyTaxes + monthlyInsurance + 
                           monthlyHOA + inputs.utilitiesMonthly + monthlyMaintenanceReserve
  
  const downPayment = inputs.purchasePrice * (inputs.downPaymentPct / 100)
  const closingCosts = inputs.purchasePrice * (inputs.closingCostRate / 100)
  const cashRequiredAtClose = downPayment + closingCosts + inputs.rehabCost
  
  const annualGrossCost = allInMonthlyCost * 12
  const annualPrincipalPaydown = getPrincipalPaidInYear(loanAmount, inputs.interestRate, inputs.termYears, 1)
  const annualNetCostOfOwnership = annualGrossCost - annualPrincipalPaydown
  
  return {
    allInMonthlyCost,
    mortgagePI,
    monthlyTaxes,
    monthlyInsurance,
    monthlyHOA,
    monthlyMaintenanceReserve,
    cashRequiredAtClose,
    annualGrossCost,
    annualPrincipalPaydown,
    annualNetCostOfOwnership,
  }
}
