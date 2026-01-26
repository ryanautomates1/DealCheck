import { 
  UnderwritingInputs, 
  UnderwritingOutputs, 
  HoldingPeriodInputs,
  HoldingPeriodOutputs,
  YearlyProjection,
  ExitScenario,
  PrimaryResidenceOutputs,
  PrimaryResidenceHoldingPeriodOutputs
} from '../types'

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
 * 
 * For investment properties: maintenance/capex/management are based on gross rent
 * For primary residences: maintenance/capex are based on property value (no management)
 */
export function calculateNOI(inputs: UnderwritingInputs): { monthly: number; annual: number } {
  // Gross income
  const grossIncomeMonthly = inputs.rentMonthly + inputs.otherIncomeMonthly
  
  // Vacancy loss
  const vacancyLossMonthly = grossIncomeMonthly * (inputs.vacancyRate / 100)
  
  // Effective income
  const effectiveIncomeMonthly = grossIncomeMonthly - vacancyLossMonthly
  
  // Determine base for percentage-based expenses
  // For primary residences (rent = 0), use property value / 12 as proxy for monthly "value"
  // This ensures maintenance/capex are calculated even without rental income
  const isPrimaryResidence = inputs.rentMonthly === 0 && inputs.managementRate === 0
  
  // For primary residence, base maintenance/capex on property value (typical 1% annual maintenance = ~0.08%/month * 12)
  // We use purchase price / 100 as a monthly proxy (roughly 1% of value annually distributed monthly)
  const expenseBase = isPrimaryResidence 
    ? inputs.purchasePrice / 100  // ~1% of property value monthly for calculation purposes
    : grossIncomeMonthly
  
  // Operating expenses (excluding debt service)
  const maintenanceMonthly = expenseBase * (inputs.maintenanceRate / 100)
  const capexMonthly = expenseBase * (inputs.capexRate / 100)
  const managementMonthly = grossIncomeMonthly * (inputs.managementRate / 100) // Management only applies to rental income
  
  const operatingExpensesMonthly =
    maintenanceMonthly + 
    capexMonthly + 
    managementMonthly + 
    inputs.taxesAnnual / 12 + 
    inputs.insuranceAnnual / 12 + 
    inputs.hoaMonthly + 
    inputs.utilitiesMonthly
  
  // NOI
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
 * Cash Flow = NOI - Debt Service (NOT Total Monthly Payment, to avoid double-counting)
 */
export function calculateCashFlow(inputs: UnderwritingInputs): { monthly: number; annual: number } {
  const noi = calculateNOI(inputs)
  const debtService = calculateDebtService(inputs)
  
  // Cash Flow = NOI - Debt Service
  // NOI already includes operating expenses (taxes, insurance, HOA, utilities, maintenance, capex, management)
  // So we only subtract debt service (P&I + PMI) to get cash flow
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
 * Calculate break-even rent (rent needed for zero cash flow)
 * Uses numerical solve approach for accuracy
 */
export function calculateBreakEvenRent(inputs: UnderwritingInputs): number {
  const debtService = calculateDebtService(inputs)
  
  // Fixed operating expenses (not dependent on rent)
  const fixedExpensesMonthly =
    inputs.taxesAnnual / 12 +
    inputs.insuranceAnnual / 12 +
    inputs.hoaMonthly +
    inputs.utilitiesMonthly
  
  // Variable expense rates (as decimal)
  const vacancyRate = inputs.vacancyRate / 100
  const maintenanceRate = inputs.maintenanceRate / 100
  const capexRate = inputs.capexRate / 100
  const managementRate = inputs.managementRate / 100
  
  // For break-even: Effective Income = Operating Expenses + Debt Service
  // rent * (1 - vacancy) - rent * (maint + capex + mgmt) - fixedExpenses = debtService
  // rent * (1 - vacancy - maint - capex - mgmt) = debtService + fixedExpenses + otherIncome
  // rent = (debtService + fixedExpenses - otherIncome) / (1 - vacancy - maint - capex - mgmt)
  
  const denominator = 1 - vacancyRate - maintenanceRate - capexRate - managementRate
  
  if (denominator <= 0) {
    // Can't break even with these assumptions - expense rates exceed 100%
    return debtService.monthly + fixedExpensesMonthly
  }
  
  const breakEvenRent = (debtService.monthly + fixedExpensesMonthly - inputs.otherIncomeMonthly) / denominator
  
  return Math.max(0, breakEvenRent)
}

/**
 * Calculate all-in cash required (down payment + closing costs + rehab)
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
// HOLDING PERIOD ANALYSIS FUNCTIONS
// =============================================================================

interface AmortizationEntry {
  month: number
  payment: number
  principal: number
  interest: number
  balance: number
}

/**
 * Generate full amortization schedule
 * Returns monthly breakdown of principal, interest, and remaining balance
 */
export function generateAmortizationSchedule(
  loanAmount: number,
  annualRate: number,
  termYears: number
): AmortizationEntry[] {
  const schedule: AmortizationEntry[] = []
  const monthlyRate = annualRate / 100 / 12
  const numPayments = termYears * 12
  const monthlyPayment = calculateMonthlyPI(loanAmount, annualRate, termYears)
  
  let balance = loanAmount
  
  for (let month = 1; month <= numPayments; month++) {
    const interestPayment = balance * monthlyRate
    const principalPayment = monthlyPayment - interestPayment
    balance = Math.max(0, balance - principalPayment)
    
    schedule.push({
      month,
      payment: monthlyPayment,
      principal: principalPayment,
      interest: interestPayment,
      balance,
    })
  }
  
  return schedule
}

/**
 * Get loan balance at end of a specific year
 */
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
  
  // Calculate balance after 'year * 12' payments
  const paymentsMade = year * 12
  
  if (monthlyRate === 0) {
    return loanAmount - (monthlyPayment * paymentsMade)
  }
  
  // Formula for remaining balance after n payments:
  // B_n = P * [(1+r)^N - (1+r)^n] / [(1+r)^N - 1]
  const balance = loanAmount * 
    (Math.pow(1 + monthlyRate, numPayments) - Math.pow(1 + monthlyRate, paymentsMade)) /
    (Math.pow(1 + monthlyRate, numPayments) - 1)
  
  return Math.max(0, balance)
}

/**
 * Get principal paid during a specific year
 */
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

/**
 * Get interest paid during a specific year
 */
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

/**
 * Calculate yearly projection for a specific year
 */
export function calculateYearlyProjection(
  inputs: HoldingPeriodInputs,
  year: number,
  previousCumulativeCashFlow: number = 0
): YearlyProjection {
  const { underwritingInputs, appreciationRate, rentGrowthRate, expenseGrowthRate } = inputs
  
  // Calculate loan parameters
  const loanAmount = underwritingInputs.purchasePrice * (1 - underwritingInputs.downPaymentPct / 100)
  
  // Property value with appreciation (compounded)
  const propertyValue = underwritingInputs.purchasePrice * Math.pow(1 + appreciationRate / 100, year)
  
  // Loan balance at end of year
  const loanBalance = getLoanBalanceAtYear(
    loanAmount, 
    underwritingInputs.interestRate, 
    underwritingInputs.termYears, 
    year
  )
  
  // Equity
  const equity = propertyValue - loanBalance
  
  // Rent with growth (compounded from year 1)
  const rentGrowthFactor = Math.pow(1 + rentGrowthRate / 100, year - 1)
  const rentAnnual = underwritingInputs.rentMonthly * 12 * rentGrowthFactor
  const otherIncomeAnnual = underwritingInputs.otherIncomeMonthly * 12 * rentGrowthFactor
  const grossIncomeAnnual = rentAnnual + otherIncomeAnnual
  
  // Vacancy loss
  const vacancyLossAnnual = grossIncomeAnnual * (underwritingInputs.vacancyRate / 100)
  const effectiveIncomeAnnual = grossIncomeAnnual - vacancyLossAnnual
  
  // Operating expenses with growth
  const expenseGrowthFactor = Math.pow(1 + expenseGrowthRate / 100, year - 1)
  
  // Fixed expenses that grow
  const taxesAnnual = underwritingInputs.taxesAnnual * expenseGrowthFactor
  const insuranceAnnual = underwritingInputs.insuranceAnnual * expenseGrowthFactor
  const hoaAnnual = underwritingInputs.hoaMonthly * 12 * expenseGrowthFactor
  const utilitiesAnnual = underwritingInputs.utilitiesMonthly * 12 * expenseGrowthFactor
  
  // Variable expenses (based on rent)
  const maintenanceAnnual = grossIncomeAnnual * (underwritingInputs.maintenanceRate / 100)
  const capexAnnual = grossIncomeAnnual * (underwritingInputs.capexRate / 100)
  const managementAnnual = grossIncomeAnnual * (underwritingInputs.managementRate / 100)
  
  const operatingExpensesAnnual = 
    taxesAnnual + 
    insuranceAnnual + 
    hoaAnnual + 
    utilitiesAnnual + 
    maintenanceAnnual + 
    capexAnnual + 
    managementAnnual
  
  // NOI
  const noiAnnual = effectiveIncomeAnnual - operatingExpensesAnnual
  
  // Debt service
  const monthlyPI = calculateMonthlyPI(loanAmount, underwritingInputs.interestRate, underwritingInputs.termYears)
  const pmi = underwritingInputs.pmiEnabled ? (underwritingInputs.pmiMonthly || 0) : 0
  const debtServiceAnnual = (monthlyPI + pmi) * 12
  
  // Principal and interest breakdown for the year
  const principalPaidAnnual = getPrincipalPaidInYear(
    loanAmount, 
    underwritingInputs.interestRate, 
    underwritingInputs.termYears, 
    year
  )
  const interestPaidAnnual = getInterestPaidInYear(
    loanAmount, 
    underwritingInputs.interestRate, 
    underwritingInputs.termYears, 
    year
  )
  
  // Cash flow
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

/**
 * Calculate full holding period projection
 */
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

/**
 * Calculate Internal Rate of Return (IRR) using Newton-Raphson method
 * 
 * Cash flows array: [initial investment (negative), year 1 cash flow, year 2, ..., final year + sale proceeds]
 */
export function calculateIRR(cashFlows: number[], maxIterations: number = 100, tolerance: number = 0.0001): number {
  // NPV function
  const npv = (rate: number): number => {
    return cashFlows.reduce((sum, cf, t) => sum + cf / Math.pow(1 + rate, t), 0)
  }
  
  // Derivative of NPV with respect to rate
  const npvDerivative = (rate: number): number => {
    return cashFlows.reduce((sum, cf, t) => {
      if (t === 0) return sum
      return sum - (t * cf) / Math.pow(1 + rate, t + 1)
    }, 0)
  }
  
  // Initial guess
  let rate = 0.1 // 10%
  
  for (let i = 0; i < maxIterations; i++) {
    const npvValue = npv(rate)
    const derivative = npvDerivative(rate)
    
    if (Math.abs(derivative) < 1e-10) {
      // Derivative too small, try different approach
      break
    }
    
    const newRate = rate - npvValue / derivative
    
    // Bound the rate to reasonable values
    if (newRate < -0.99) {
      rate = -0.99
    } else if (newRate > 10) {
      rate = 10
    } else {
      rate = newRate
    }
    
    if (Math.abs(npvValue) < tolerance) {
      return rate * 100 // Return as percentage
    }
  }
  
  // If Newton-Raphson fails, try bisection method
  let lower = -0.99
  let upper = 10.0
  
  for (let i = 0; i < maxIterations; i++) {
    const mid = (lower + upper) / 2
    const npvMid = npv(mid)
    
    if (Math.abs(npvMid) < tolerance || (upper - lower) / 2 < tolerance) {
      return mid * 100
    }
    
    if (npv(lower) * npvMid < 0) {
      upper = mid
    } else {
      lower = mid
    }
  }
  
  return rate * 100 // Return best estimate
}

/**
 * Calculate exit scenario when selling the property
 */
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
  
  // Total profit = Net proceeds + Cumulative cash flow - Initial investment
  const totalProfit = netProceedsFromSale + cumulativeCashFlow - initialInvestment
  
  // Total ROI
  const totalROI = initialInvestment > 0 ? (totalProfit / initialInvestment) * 100 : 0
  
  // Annualized ROI (CAGR)
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

/**
 * Calculate complete holding period analysis
 */
export function calculateHoldingPeriodAnalysis(inputs: HoldingPeriodInputs): HoldingPeriodOutputs {
  const yearlyProjections = calculateHoldingPeriodProjection(inputs)
  const exitScenario = calculateExitScenario(inputs, yearlyProjections)
  
  // Build cash flows for IRR calculation
  // Year 0: Initial investment (negative)
  // Years 1 to N-1: Annual cash flow
  // Year N: Annual cash flow + Net proceeds from sale
  const initialInvestment = calculateAllInCashRequired(inputs.underwritingInputs)
  const cashFlows: number[] = [-initialInvestment]
  
  for (let i = 0; i < yearlyProjections.length; i++) {
    const projection = yearlyProjections[i]
    if (i === yearlyProjections.length - 1) {
      // Last year: add net sale proceeds to cash flow
      cashFlows.push(projection.cashFlowAnnual + exitScenario.netProceedsFromSale)
    } else {
      cashFlows.push(projection.cashFlowAnnual)
    }
  }
  
  const irr = calculateIRR(cashFlows)
  
  // Equity multiple = Total returns / Initial investment
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
// PRIMARY RESIDENCE ANALYSIS FUNCTIONS
// =============================================================================

/**
 * Calculate primary residence metrics - homeowner-centric view
 * Focuses on cost of living rather than investment returns
 */
export function calculatePrimaryResidenceAnalysis(inputs: UnderwritingInputs): PrimaryResidenceOutputs {
  const loanAmount = inputs.purchasePrice * (1 - inputs.downPaymentPct / 100)
  
  // Monthly breakdown
  const mortgagePI = calculateMonthlyPI(loanAmount, inputs.interestRate, inputs.termYears)
  const monthlyTaxes = inputs.taxesAnnual / 12
  const monthlyInsurance = inputs.insuranceAnnual / 12
  const monthlyHOA = inputs.hoaMonthly
  const pmi = inputs.pmiEnabled ? (inputs.pmiMonthly || 0) : 0
  
  // Maintenance reserve based on property value (typical 1% annual = ~0.083%/month)
  const monthlyMaintenanceReserve = inputs.purchasePrice * (inputs.maintenanceRate / 100 / 12) +
                                     inputs.purchasePrice * (inputs.capexRate / 100 / 12)
  
  // All-in monthly cost (what you pay each month to live here)
  const allInMonthlyCost = mortgagePI + pmi + monthlyTaxes + monthlyInsurance + 
                           monthlyHOA + inputs.utilitiesMonthly + monthlyMaintenanceReserve
  
  // Cash required at close
  const downPayment = inputs.purchasePrice * (inputs.downPaymentPct / 100)
  const closingCosts = inputs.purchasePrice * (inputs.closingCostRate / 100)
  const cashRequiredAtClose = downPayment + closingCosts + inputs.rehabCost
  
  // Annual view
  const annualGrossCost = allInMonthlyCost * 12
  
  // First year principal paydown
  const annualPrincipalPaydown = getPrincipalPaidInYear(loanAmount, inputs.interestRate, inputs.termYears, 1)
  
  // Net cost = what you "spend" after accounting for equity building
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

/**
 * Calculate primary residence holding period analysis
 * Reframes around time, flexibility, and risk rather than IRR
 */
export function calculatePrimaryResidenceHoldingPeriod(
  inputs: HoldingPeriodInputs,
  marketRentMonthly: number = 0
): PrimaryResidenceHoldingPeriodOutputs {
  const { underwritingInputs, holdingPeriodYears, appreciationRate, sellingCostRate } = inputs
  const loanAmount = underwritingInputs.purchasePrice * (1 - underwritingInputs.downPaymentPct / 100)
  
  // Calculate monthly cost for first year (approximation for break-even)
  const primaryResidence = calculatePrimaryResidenceAnalysis(underwritingInputs)
  
  // Equity accumulation over the period
  let totalPrincipalPaydown = 0
  for (let year = 1; year <= holdingPeriodYears; year++) {
    totalPrincipalPaydown += getPrincipalPaidInYear(loanAmount, underwritingInputs.interestRate, underwritingInputs.termYears, year)
  }
  
  const endPropertyValue = underwritingInputs.purchasePrice * Math.pow(1 + appreciationRate / 100, holdingPeriodYears)
  const totalAppreciation = endPropertyValue - underwritingInputs.purchasePrice
  const totalEquityAccumulation = totalPrincipalPaydown + totalAppreciation + 
    (underwritingInputs.purchasePrice * underwritingInputs.downPaymentPct / 100)
  
  // Net cost of housing over period (simplified - assumes constant costs)
  const netCostOfHousingTotal = primaryResidence.annualNetCostOfOwnership * holdingPeriodYears
  const netCostOfHousingMonthlyEquivalent = netCostOfHousingTotal / (holdingPeriodYears * 12)
  
  // Break-even year vs renting
  let breakEvenYearBuyVsRent: number | null = null
  if (marketRentMonthly > 0) {
    // Find year where cumulative cost of ownership < cumulative rent
    // accounting for equity buildup and appreciation
    for (let year = 1; year <= Math.min(30, holdingPeriodYears + 10); year++) {
      const cumulativeRent = marketRentMonthly * 12 * year
      const cumulativeOwnershipCost = primaryResidence.annualGrossCost * year
      const equityAtYear = (underwritingInputs.purchasePrice * underwritingInputs.downPaymentPct / 100)
      let principalPaidToYear = 0
      for (let y = 1; y <= year; y++) {
        principalPaidToYear += getPrincipalPaidInYear(loanAmount, underwritingInputs.interestRate, underwritingInputs.termYears, y)
      }
      const appreciationAtYear = underwritingInputs.purchasePrice * (Math.pow(1 + appreciationRate / 100, year) - 1)
      const totalEquityAtYear = equityAtYear + principalPaidToYear + appreciationAtYear
      
      // Net wealth from owning = equity - cumulative cost
      // Net wealth from renting = investment of down payment - cumulative rent
      // Assume renter invests down payment at modest return (3%)
      const renterInvestmentGrowth = primaryResidence.cashRequiredAtClose * (Math.pow(1.03, year) - 1)
      
      const netWealthOwning = totalEquityAtYear - cumulativeOwnershipCost
      const netWealthRenting = primaryResidence.cashRequiredAtClose + renterInvestmentGrowth - cumulativeRent
      
      if (netWealthOwning > netWealthRenting) {
        breakEvenYearBuyVsRent = year
        break
      }
    }
  }
  
  // Exit scenarios at years 3, 5, 7
  const exitScenarios = [3, 5, 7].filter(y => y <= holdingPeriodYears + 3).map(year => {
    const propertyValueAtYear = underwritingInputs.purchasePrice * Math.pow(1 + appreciationRate / 100, year)
    const loanBalanceAtYear = getLoanBalanceAtYear(loanAmount, underwritingInputs.interestRate, underwritingInputs.termYears, year)
    const sellingCosts = propertyValueAtYear * (sellingCostRate / 100)
    const netProceedsFromSale = propertyValueAtYear - sellingCosts - loanBalanceAtYear
    const totalHousingCostToDate = primaryResidence.annualGrossCost * year
    
    // Compare to renting
    const cumulativeRent = marketRentMonthly > 0 ? marketRentMonthly * 12 * year : 0
    const renterInvestmentGrowth = primaryResidence.cashRequiredAtClose * (Math.pow(1.03, year) - 1)
    const renterNetWealth = primaryResidence.cashRequiredAtClose + renterInvestmentGrowth - cumulativeRent
    const ownerNetWealth = netProceedsFromSale - totalHousingCostToDate + primaryResidence.cashRequiredAtClose
    
    return {
      year,
      netProceedsFromSale,
      totalHousingCostToDate,
      netPositionVsRenting: ownerNetWealth - renterNetWealth,
    }
  })
  
  // Sensitivity analysis - flat price scenario (0% appreciation)
  const flatPropertyValue = underwritingInputs.purchasePrice
  const flatLoanBalance = getLoanBalanceAtYear(loanAmount, underwritingInputs.interestRate, underwritingInputs.termYears, holdingPeriodYears)
  const flatSellingCosts = flatPropertyValue * (sellingCostRate / 100)
  const flatNetProceeds = flatPropertyValue - flatSellingCosts - flatLoanBalance
  const flatTotalCost = primaryResidence.annualGrossCost * holdingPeriodYears
  const flatEffectiveMonthlyCost = (flatTotalCost - flatNetProceeds + primaryResidence.cashRequiredAtClose) / (holdingPeriodYears * 12)
  
  // Sensitivity analysis - negative price scenario (-10% from purchase)
  const negativePropertyValue = underwritingInputs.purchasePrice * 0.9
  const negativeLoanBalance = getLoanBalanceAtYear(loanAmount, underwritingInputs.interestRate, underwritingInputs.termYears, holdingPeriodYears)
  const negativeSellingCosts = negativePropertyValue * (sellingCostRate / 100)
  const negativeNetProceeds = negativePropertyValue - negativeSellingCosts - negativeLoanBalance
  const negativeTotalCost = primaryResidence.annualGrossCost * holdingPeriodYears
  const negativeEffectiveMonthlyCost = (negativeTotalCost - negativeNetProceeds + primaryResidence.cashRequiredAtClose) / (holdingPeriodYears * 12)
  
  return {
    breakEvenYearBuyVsRent,
    netCostOfHousingTotal,
    netCostOfHousingMonthlyEquivalent,
    equityFromPrincipalPaydown: totalPrincipalPaydown,
    equityFromAppreciation: totalAppreciation,
    totalEquityAccumulation,
    exitScenarios,
    flatPriceScenario: {
      netProceedsAtSale: flatNetProceeds,
      effectiveMonthlyCost: flatEffectiveMonthlyCost,
    },
    negativePriceScenario: {
      netProceedsAtSale: negativeNetProceeds,
      effectiveMonthlyCost: negativeEffectiveMonthlyCost,
    },
  }
}
