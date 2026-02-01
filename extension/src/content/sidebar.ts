/**
 * Analysis sidebar component
 * Displays property data, assumptions inputs, and calculated metrics
 */

import { extractZillowData } from './extractors'
import { calculateUnderwriting, calculatePrimaryResidenceAnalysis, calculateAllInCashRequired, calculateHoldingPeriodAnalysis } from '../lib/engine'
import { 
  UnderwritingInputs, 
  PrimaryResidenceOutputs,
  ScrapedPropertyData, 
  UserAssumptions, 
  DEFAULT_ASSUMPTIONS,
  INVESTMENT_ASSUMPTIONS,
  PurchaseType
} from '../lib/types'
import { escapeHtml } from '../lib/utils'

let sidebarElement: HTMLElement | null = null
let currentAssumptions: UserAssumptions = { ...DEFAULT_ASSUMPTIONS }
let scrapedData: ScrapedPropertyData = {}
let isLoggedIn = false
let authToken: string | null = null

// Check auth status
async function checkAuthStatus(): Promise<void> {
  try {
    const result = await chrome.storage.sync.get(['authToken', 'userEmail'])
    authToken = result.authToken || null
    isLoggedIn = !!authToken
  } catch (e) {
    isLoggedIn = false
    authToken = null
  }
}

// Format currency
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

// Format percentage
function formatPercent(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`
}

// Build underwriting inputs from scraped data and assumptions
function buildInputs(): UnderwritingInputs {
  const price = scrapedData.listPrice || 0
  const isPrimaryResidence = currentAssumptions.purchaseType === 'primary_residence'
  
  return {
    purchasePrice: price,
    closingCostRate: currentAssumptions.closingCostRate,
    rehabCost: 0,
    downPaymentPct: currentAssumptions.downPaymentPct,
    interestRate: currentAssumptions.interestRate,
    termYears: currentAssumptions.termYears,
    pmiEnabled: currentAssumptions.downPaymentPct < 20,
    pmiMonthly: currentAssumptions.downPaymentPct < 20 ? (price * 0.005 / 12) : 0,
    taxesAnnual: scrapedData.taxesAnnual || (price * 0.012),
    insuranceAnnual: scrapedData.insuranceAnnual || (price * 0.0035),
    hoaMonthly: scrapedData.hoaMonthly || 0,
    utilitiesMonthly: 0,
    rentMonthly: isPrimaryResidence ? 0 : (currentAssumptions.estimatedRent || price * 0.007),
    otherIncomeMonthly: 0,
    vacancyRate: isPrimaryResidence ? 0 : currentAssumptions.vacancyRate,
    maintenanceRate: currentAssumptions.maintenanceRate,
    capexRate: currentAssumptions.capexRate,
    managementRate: isPrimaryResidence ? 0 : currentAssumptions.managementRate,
  }
}

// Build holding period inputs for analysis
function buildHoldingPeriodInputs(): { underwritingInputs: UnderwritingInputs; holdingPeriodYears: number; appreciationRate: number; rentGrowthRate: number; expenseGrowthRate: number; sellingCostRate: number } {
  return {
    underwritingInputs: buildInputs(),
    holdingPeriodYears: currentAssumptions.holdingPeriodYears,
    appreciationRate: currentAssumptions.appreciationRate,
    rentGrowthRate: currentAssumptions.rentGrowthRate,
    expenseGrowthRate: currentAssumptions.expenseGrowthRate,
    sellingCostRate: currentAssumptions.sellingCostRate,
  }
}

// Create sidebar HTML
function createSidebarHTML(): string {
  const inputs = buildInputs()
  const outputs = calculateUnderwriting(inputs)
  const isPrimaryResidence = currentAssumptions.purchaseType === 'primary_residence'
  const primaryOutputs = isPrimaryResidence ? calculatePrimaryResidenceAnalysis(inputs) : null
  
  const holdingPeriodInputs = buildHoldingPeriodInputs()
  const holdingPeriodOutputs = currentAssumptions.holdingPeriodYears > 0
    ? calculateHoldingPeriodAnalysis(holdingPeriodInputs)
    : null
  
  const addressDisplay = escapeHtml(scrapedData.address || 'Property Address')
  const priceDisplay = scrapedData.listPrice ? formatCurrency(scrapedData.listPrice) : '$--'
  const bedsDisplay = escapeHtml(String(scrapedData.beds ?? '--'))
  const bathsDisplay = escapeHtml(String(scrapedData.baths ?? '--'))
  const sqftDisplay = escapeHtml(scrapedData.sqft ? scrapedData.sqft.toLocaleString() : '--')
  
  // Advanced Analysis (Cap Rate, NOI, DSCR, Break-Even) only for investment / house hack — never for primary residence
  const showAdvancedAnalysis = currentAssumptions.purchaseType !== 'primary_residence'
  const advancedAnalysisHTML = showAdvancedAnalysis
    ? `
      <div class="dm-section dm-metrics dm-premium ${isLoggedIn ? '' : 'dm-locked'}">
        <div class="dm-section-header">
          <span>Advanced Analysis</span>
          ${!isLoggedIn ? '<span class="dm-badge dm-badge-premium">PRO</span>' : ''}
        </div>
        ${isLoggedIn ? `
        <div class="dm-metric-row">
          <span class="dm-metric-label">Cap Rate</span>
          <span class="dm-metric-value">${formatPercent(outputs.capRate)}</span>
        </div>
        <div class="dm-metric-row">
          <span class="dm-metric-label">NOI (Annual)</span>
          <span class="dm-metric-value">${formatCurrency(outputs.noiAnnual)}</span>
        </div>
        <div class="dm-metric-row">
          <span class="dm-metric-label">DSCR</span>
          <span class="dm-metric-value">${outputs.dscr.toFixed(2)}x</span>
        </div>
        <div class="dm-metric-row">
          <span class="dm-metric-label">Break-Even Rent</span>
          <span class="dm-metric-value">${formatCurrency(outputs.breakEvenRentMonthly)}</span>
        </div>
        ` : `
        <div class="dm-lock-overlay">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <span>Cap Rate, NOI, DSCR, IRR...</span>
          <button class="dm-btn dm-btn-primary dm-btn-small" id="dm-sign-in">Sign in to unlock</button>
        </div>
        `}
      </div>
      `
    : ''

  // Monthly payment breakdown
  const loanAmount = inputs.purchasePrice * (1 - inputs.downPaymentPct / 100)
  const monthlyPI = loanAmount > 0 ? (loanAmount * (inputs.interestRate / 100 / 12) * Math.pow(1 + inputs.interestRate / 100 / 12, inputs.termYears * 12)) / (Math.pow(1 + inputs.interestRate / 100 / 12, inputs.termYears * 12) - 1) : 0
  const monthlyTaxes = inputs.taxesAnnual / 12
  const monthlyInsurance = inputs.insuranceAnnual / 12
  const pmi = inputs.pmiEnabled ? inputs.pmiMonthly : 0
  const totalMonthly = monthlyPI + pmi + monthlyTaxes + monthlyInsurance + inputs.hoaMonthly
  
  return `
    <div class="dm-sidebar-header">
      <div class="dm-sidebar-title">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
        <span>DealMetrics</span>
      </div>
      <button class="dm-close-btn" id="dm-close-sidebar">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
    
    <div class="dm-sidebar-content">
      <!-- Property Summary -->
      <div class="dm-section dm-property-summary">
        <div class="dm-property-address">${addressDisplay}</div>
        <div class="dm-property-details">
          <span class="dm-price">${priceDisplay}</span>
          <span class="dm-separator">|</span>
          <span>${bedsDisplay} bd</span>
          <span class="dm-separator">|</span>
          <span>${bathsDisplay} ba</span>
          <span class="dm-separator">|</span>
          <span>${sqftDisplay} sqft</span>
        </div>
        <button class="dm-refresh-btn" id="dm-refresh-data">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M23 4v6h-6M1 20v-6h6"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          Refresh
        </button>
      </div>
      
      <!-- Assumptions -->
      <div class="dm-section dm-assumptions">
        <div class="dm-section-header">
          <span>Assumptions</span>
          <button class="dm-toggle-advanced" id="dm-toggle-advanced">Advanced</button>
        </div>
        
        <div class="dm-input-row">
          <label>Purchase Type</label>
          <select id="dm-purchase-type" class="dm-select">
            <option value="primary_residence" ${currentAssumptions.purchaseType === 'primary_residence' ? 'selected' : ''}>Primary Residence</option>
            <option value="investment_property" ${currentAssumptions.purchaseType === 'investment_property' ? 'selected' : ''}>Investment</option>
            <option value="house_hack" ${currentAssumptions.purchaseType === 'house_hack' ? 'selected' : ''}>House Hack</option>
          </select>
        </div>
        
        <div class="dm-input-row">
          <label>Down Payment</label>
          <div class="dm-input-group">
            <input type="number" id="dm-down-payment" value="${currentAssumptions.downPaymentPct}" min="0" max="100" step="1" class="dm-input">
            <span class="dm-input-suffix">%</span>
          </div>
        </div>
        
        <div class="dm-input-row">
          <label>Interest Rate</label>
          <div class="dm-input-group">
            <input type="number" id="dm-interest-rate" value="${currentAssumptions.interestRate}" min="0" max="20" step="0.125" class="dm-input">
            <span class="dm-input-suffix">%</span>
          </div>
        </div>
        
        <div class="dm-input-row">
          <label>Loan Term</label>
          <select id="dm-loan-term" class="dm-select">
            <option value="30" ${currentAssumptions.termYears === 30 ? 'selected' : ''}>30 years</option>
            <option value="15" ${currentAssumptions.termYears === 15 ? 'selected' : ''}>15 years</option>
          </select>
        </div>
        
        <!-- Advanced inputs (hidden by default) -->
        <div class="dm-advanced-inputs" id="dm-advanced-inputs" style="display: none;">
          <div class="dm-input-row">
            <label>Closing Costs</label>
            <div class="dm-input-group">
              <input type="number" id="dm-closing-costs" value="${currentAssumptions.closingCostRate}" min="0" max="10" step="0.5" class="dm-input">
              <span class="dm-input-suffix">%</span>
            </div>
          </div>
          
          ${!isPrimaryResidence ? `
          <div class="dm-input-row">
            <label>Vacancy Rate</label>
            <div class="dm-input-group">
              <input type="number" id="dm-vacancy" value="${currentAssumptions.vacancyRate}" min="0" max="50" step="1" class="dm-input">
              <span class="dm-input-suffix">%</span>
            </div>
          </div>
          
          <div class="dm-input-row">
            <label>Management Fee</label>
            <div class="dm-input-group">
              <input type="number" id="dm-management" value="${currentAssumptions.managementRate}" min="0" max="20" step="1" class="dm-input">
              <span class="dm-input-suffix">%</span>
            </div>
          </div>
          ` : ''}
          
          <div class="dm-input-row">
            <label>Maintenance</label>
            <div class="dm-input-group">
              <input type="number" id="dm-maintenance" value="${currentAssumptions.maintenanceRate}" min="0" max="20" step="0.5" class="dm-input">
              <span class="dm-input-suffix">%</span>
            </div>
          </div>
          
          <div class="dm-input-row">
            <label>CapEx Reserve</label>
            <div class="dm-input-group">
              <input type="number" id="dm-capex" value="${currentAssumptions.capexRate}" min="0" max="20" step="0.5" class="dm-input">
              <span class="dm-input-suffix">%</span>
            </div>
          </div>
          
          ${!isPrimaryResidence ? `
          <div class="dm-input-row">
            <label>Expected Rent</label>
            <div class="dm-input-group">
              <span class="dm-input-prefix">$</span>
              <input type="number" id="dm-rent" value="${currentAssumptions.estimatedRent}" min="0" step="50" class="dm-input dm-input-currency">
              <span class="dm-input-suffix">/mo</span>
            </div>
          </div>
          ` : ''}
        </div>
      </div>
      
      <!-- Monthly Payment Breakdown (FREE) -->
      <div class="dm-section dm-metrics">
        <div class="dm-section-header">
          <span>Monthly Payment</span>
        </div>
        
        <div class="dm-metric-row">
          <span class="dm-metric-label">Principal & Interest</span>
          <span class="dm-metric-value">${formatCurrency(monthlyPI)}</span>
        </div>
        ${pmi > 0 ? `
        <div class="dm-metric-row">
          <span class="dm-metric-label">PMI</span>
          <span class="dm-metric-value">${formatCurrency(pmi)}</span>
        </div>
        ` : ''}
        <div class="dm-metric-row">
          <span class="dm-metric-label">
            Property Taxes
            <span class="dm-tax-source">${scrapedData.taxSource === 'actual' && scrapedData.taxYear ? `(${scrapedData.taxYear})` : '(est.)'}</span>
          </span>
          <span class="dm-metric-value">${formatCurrency(monthlyTaxes)}</span>
        </div>
        <div class="dm-metric-row">
          <span class="dm-metric-label">
            Insurance
            <span class="dm-tax-source">${scrapedData.insuranceSource === 'actual' ? '(Zillow)' : '(est.)'}</span>
          </span>
          <span class="dm-metric-value">${formatCurrency(monthlyInsurance)}</span>
        </div>
        ${inputs.hoaMonthly > 0 ? `
        <div class="dm-metric-row">
          <span class="dm-metric-label">HOA</span>
          <span class="dm-metric-value">${formatCurrency(inputs.hoaMonthly)}</span>
        </div>
        ` : ''}
        <div class="dm-metric-row dm-metric-total">
          <span class="dm-metric-label">Total Monthly</span>
          <span class="dm-metric-value">${formatCurrency(totalMonthly)}</span>
        </div>
      </div>
      
      <!-- Key Metrics (FREE) -->
      <div class="dm-section dm-metrics">
        <div class="dm-section-header">
          <span>Key Metrics</span>
          <span class="dm-badge dm-badge-free">FREE</span>
        </div>
        
        <div class="dm-metric-row dm-metric-highlight">
          <span class="dm-metric-label">Cash Required</span>
          <span class="dm-metric-value">${formatCurrency(outputs.allInCashRequired)}</span>
        </div>
        
        ${!isPrimaryResidence ? `
        <div class="dm-metric-row ${outputs.cashFlowMonthly >= 0 ? 'dm-positive' : 'dm-negative'}">
          <span class="dm-metric-label">Monthly Cash Flow</span>
          <span class="dm-metric-value">${formatCurrency(outputs.cashFlowMonthly)}</span>
        </div>
        
        <div class="dm-metric-row ${outputs.cashOnCash >= 0 ? 'dm-positive' : 'dm-negative'}">
          <span class="dm-metric-label">Cash-on-Cash Return</span>
          <span class="dm-metric-value">${formatPercent(outputs.cashOnCash)}</span>
        </div>
        ` : `
        <div class="dm-metric-row">
          <span class="dm-metric-label">True Monthly Cost</span>
          <span class="dm-metric-value dm-metric-subtext">
            ${formatCurrency(primaryOutputs?.annualNetCostOfOwnership ? primaryOutputs.annualNetCostOfOwnership / 12 : 0)}
            <small>(after equity)</small>
          </span>
        </div>
        `}
      </div>
      
      <!-- Holding Period Analysis (website-style: assumptions + metrics + exit scenario) -->
      <div class="dm-section dm-holding-period">
        <div class="dm-section-header">
          <span>${currentAssumptions.holdingPeriodYears}-Year ${isPrimaryResidence ? 'Ownership' : 'Holding Period'} Analysis</span>
        </div>
        
        <p class="dm-holding-desc">Configure assumptions for multi-year projections.</p>
        
        <div class="dm-holding-inputs" id="dm-holding-inputs">
          <div class="dm-input-row">
            <label>Hold (years)</label>
            <div class="dm-input-group">
              <input type="number" id="dm-holding-years" value="${currentAssumptions.holdingPeriodYears}" min="1" max="30" step="1" class="dm-input">
              <span class="dm-input-suffix">yrs</span>
            </div>
          </div>
          <div class="dm-input-row">
            <label>Appreciation</label>
            <div class="dm-input-group">
              <input type="number" id="dm-appreciation" value="${currentAssumptions.appreciationRate}" min="-5" max="15" step="0.5" class="dm-input">
              <span class="dm-input-suffix">%/yr</span>
            </div>
          </div>
          ${!isPrimaryResidence ? `
          <div class="dm-input-row">
            <label>Rent Growth</label>
            <div class="dm-input-group">
              <input type="number" id="dm-rent-growth" value="${currentAssumptions.rentGrowthRate}" min="-5" max="15" step="0.5" class="dm-input">
              <span class="dm-input-suffix">%/yr</span>
            </div>
          </div>
          ` : ''}
          <div class="dm-input-row">
            <label>Expense Growth</label>
            <div class="dm-input-group">
              <input type="number" id="dm-expense-growth" value="${currentAssumptions.expenseGrowthRate}" min="-5" max="15" step="0.5" class="dm-input">
              <span class="dm-input-suffix">%/yr</span>
            </div>
          </div>
          <div class="dm-input-row">
            <label>Selling Cost</label>
            <div class="dm-input-group">
              <input type="number" id="dm-selling-cost" value="${currentAssumptions.sellingCostRate}" min="0" max="15" step="0.5" class="dm-input">
              <span class="dm-input-suffix">%</span>
            </div>
          </div>
        </div>
        
        ${holdingPeriodOutputs ? `
        <div class="dm-holding-cards">
          <div class="dm-holding-card dm-card-irr">
            <div class="dm-holding-card-label">IRR</div>
            <div class="dm-holding-card-value ${holdingPeriodOutputs.irr >= 0 ? 'dm-positive' : 'dm-negative'}">${formatPercent(holdingPeriodOutputs.irr)}</div>
            <div class="dm-holding-card-hint">Annualized return</div>
          </div>
          <div class="dm-holding-card dm-card-em">
            <div class="dm-holding-card-label">Equity Multiple</div>
            <div class="dm-holding-card-value">${holdingPeriodOutputs.equityMultiple.toFixed(2)}x</div>
            <div class="dm-holding-card-hint">Total return / invested</div>
          </div>
          <div class="dm-holding-card dm-card-profit">
            <div class="dm-holding-card-label">Total Profit</div>
            <div class="dm-holding-card-value ${holdingPeriodOutputs.exitScenario.totalProfit >= 0 ? 'dm-positive' : 'dm-negative'}">${formatCurrency(holdingPeriodOutputs.exitScenario.totalProfit)}</div>
            <div class="dm-holding-card-hint">Cash flow + sale - investment</div>
          </div>
          <div class="dm-holding-card dm-card-roi">
            <div class="dm-holding-card-label">Total ROI</div>
            <div class="dm-holding-card-value ${holdingPeriodOutputs.exitScenario.totalROI >= 0 ? 'dm-positive' : 'dm-negative'}">${formatPercent(holdingPeriodOutputs.exitScenario.totalROI)}</div>
            <div class="dm-holding-card-hint">Profit / initial investment</div>
          </div>
        </div>
        
        <div class="dm-exit-scenario">
          <div class="dm-exit-title">Exit Scenario (Year ${currentAssumptions.holdingPeriodYears})</div>
          <div class="dm-exit-rows">
            <div class="dm-exit-row">
              <span class="dm-exit-label">Sale Price</span>
              <span class="dm-exit-value">${formatCurrency(holdingPeriodOutputs.exitScenario.salePrice)}</span>
            </div>
            <div class="dm-exit-row">
              <span class="dm-exit-label">Selling Costs</span>
              <span class="dm-exit-value dm-negative">-${formatCurrency(holdingPeriodOutputs.exitScenario.sellingCosts)}</span>
            </div>
            <div class="dm-exit-row">
              <span class="dm-exit-label">Loan Payoff</span>
              <span class="dm-exit-value dm-negative">-${formatCurrency(holdingPeriodOutputs.exitScenario.loanPayoff)}</span>
            </div>
            <div class="dm-exit-row dm-exit-row-highlight">
              <span class="dm-exit-label">Net Proceeds</span>
              <span class="dm-exit-value dm-positive">${formatCurrency(holdingPeriodOutputs.exitScenario.netProceedsFromSale)}</span>
            </div>
            <div class="dm-exit-row">
              <span class="dm-exit-label">Cumulative Cash Flow</span>
              <span class="dm-exit-value ${holdingPeriodOutputs.exitScenario.cumulativeCashFlow >= 0 ? 'dm-positive' : 'dm-negative'}">${formatCurrency(holdingPeriodOutputs.exitScenario.cumulativeCashFlow)}</span>
            </div>
            <div class="dm-exit-row">
              <span class="dm-exit-label">Initial Investment</span>
              <span class="dm-exit-value">${formatCurrency(holdingPeriodOutputs.exitScenario.initialInvestment)}</span>
            </div>
          </div>
        </div>
        
        ` : ''}
      </div>
      
      ${advancedAnalysisHTML}
    </div>
    
    <!-- Footer Actions -->
    <div class="dm-sidebar-footer">
      ${isLoggedIn ? `
      <button class="dm-btn dm-btn-primary dm-btn-full" id="dm-save-deal">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
          <polyline points="17 21 17 13 7 13 7 21"/>
          <polyline points="7 3 7 8 15 8"/>
        </svg>
        Save to Dashboard
      </button>
      ` : `
      <button class="dm-btn dm-btn-primary dm-btn-full" id="dm-sign-in-footer">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
          <polyline points="10 17 15 12 10 7"/>
          <line x1="15" y1="12" x2="3" y2="12"/>
        </svg>
        Sign in to Save
      </button>
      `}
      <div class="dm-footer-links">
        <a href="https://getdealmetrics.com" target="_blank">Open DealMetrics</a>
      </div>
    </div>
  `
}

// Create sidebar styles
function createSidebarStyles(): string {
  return `
    #dealmetrics-sidebar {
      position: fixed;
      top: 0;
      right: 0;
      width: 360px;
      height: 100vh;
      background: #ffffff;
      box-shadow: -4px 0 20px rgba(0, 0, 0, 0.15);
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      color: #1f2937;
      font-size: 14px;
      line-height: 1.5;
    }
    
    .dm-sidebar-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      background: linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 100%);
      color: white;
    }
    
    .dm-sidebar-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
      font-size: 16px;
    }
    
    .dm-close-btn {
      background: rgba(255, 255, 255, 0.1);
      border: none;
      color: white;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
    }
    
    .dm-close-btn:hover {
      background: rgba(255, 255, 255, 0.2);
    }
    
    .dm-sidebar-content {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
    }
    
    .dm-section {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 12px;
    }
    
    .dm-section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
      font-weight: 600;
      color: #374151;
    }
    
    .dm-property-summary {
      background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
      border-color: #bae6fd;
    }
    
    .dm-property-address {
      font-weight: 600;
      font-size: 15px;
      color: #0f172a;
      margin-bottom: 4px;
    }
    
    .dm-property-details {
      color: #64748b;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }
    
    .dm-price {
      font-weight: 600;
      color: #0369a1;
    }
    
    .dm-separator {
      color: #cbd5e1;
    }
    
    .dm-refresh-btn {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-top: 12px;
      padding: 6px 12px;
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      font-size: 12px;
      color: #64748b;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .dm-refresh-btn:hover {
      background: #f1f5f9;
      color: #334155;
    }
    
    .dm-input-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 10px;
    }
    
    .dm-input-row label {
      font-size: 13px;
      color: #4b5563;
    }
    
    .dm-input-group {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    
    .dm-input, .dm-select {
      width: 80px;
      padding: 6px 8px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 13px;
      color: #1f2937;
      background: white;
      text-align: right;
    }
    
    .dm-input:focus, .dm-select:focus {
      outline: none;
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }
    
    .dm-select {
      width: auto;
      text-align: left;
      cursor: pointer;
    }
    
    .dm-input-suffix, .dm-input-prefix {
      font-size: 12px;
      color: #9ca3af;
    }
    
    .dm-input-currency {
      width: 90px;
    }
    
    .dm-toggle-advanced {
      font-size: 12px;
      color: #6b7280;
      background: none;
      border: none;
      cursor: pointer;
      text-decoration: underline;
    }
    
    .dm-toggle-advanced:hover {
      color: #3b82f6;
    }
    
    .dm-holding-desc {
      font-size: 12px;
      color: #6b7280;
      margin: 0 0 12px 0;
    }
    
    .dm-holding-inputs {
      margin-bottom: 14px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 12px;
    }
    
    .dm-holding-inputs .dm-input-row {
      margin-bottom: 0;
    }
    
    .dm-holding-cards {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-bottom: 14px;
    }
    
    .dm-holding-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 12px;
    }
    
    .dm-holding-card-label {
      font-size: 11px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.02em;
      margin-bottom: 2px;
    }
    
    .dm-holding-card-value {
      font-size: 16px;
      font-weight: 700;
      color: #1e293b;
    }
    
    .dm-holding-card-hint {
      font-size: 10px;
      color: #94a3b8;
      margin-top: 2px;
    }
    
    .dm-exit-scenario {
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 12px;
      margin-bottom: 12px;
    }
    
    .dm-exit-title {
      font-size: 12px;
      font-weight: 600;
      color: #475569;
      margin-bottom: 8px;
    }
    
    .dm-exit-rows {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    
    .dm-exit-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
    }
    
    .dm-exit-row-highlight {
      border-top: 1px solid #cbd5e1;
      margin-top: 4px;
      padding-top: 6px;
      font-weight: 600;
    }
    
    .dm-exit-label {
      color: #64748b;
    }
    
    .dm-exit-value {
      font-weight: 600;
      color: #1e293b;
    }
    
    .dm-yearly-summary {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 12px;
    }
    
    .dm-yearly-title {
      font-size: 12px;
      font-weight: 600;
      color: #475569;
      margin-bottom: 6px;
    }
    
    .dm-yearly-rows {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    
    .dm-yearly-row {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
    }
    
    .dm-yearly-label {
      color: #64748b;
    }
    
    .dm-yearly-value {
      font-weight: 500;
      color: #1e293b;
    }
    
    .dm-advanced-inputs {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px dashed #e5e7eb;
    }
    
    .dm-metric-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #f1f5f9;
    }
    
    .dm-metric-row:last-child {
      border-bottom: none;
    }
    
    .dm-metric-label {
      font-size: 13px;
      color: #6b7280;
    }
    
    .dm-tax-source {
      font-size: 10px;
      color: #9ca3af;
      font-weight: 400;
      margin-left: 4px;
    }
    
    .dm-metric-value {
      font-weight: 600;
      color: #1f2937;
    }
    
    .dm-metric-subtext {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
    }
    
    .dm-metric-subtext small {
      font-size: 10px;
      font-weight: 400;
      color: #9ca3af;
    }
    
    .dm-metric-total {
      margin-top: 8px;
      padding-top: 12px;
      border-top: 2px solid #e2e8f0;
    }
    
    .dm-metric-total .dm-metric-value {
      font-size: 16px;
      color: #0369a1;
    }
    
    .dm-metric-highlight {
      background: #f0f9ff;
      margin: -8px -16px;
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 8px;
    }
    
    .dm-positive .dm-metric-value {
      color: #059669;
    }
    
    .dm-negative .dm-metric-value {
      color: #dc2626;
    }
    
    .dm-badge {
      font-size: 10px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 10px;
      text-transform: uppercase;
    }
    
    .dm-badge-free {
      background: #dcfce7;
      color: #166534;
    }
    
    .dm-badge-premium {
      background: #fef3c7;
      color: #92400e;
    }
    
    .dm-premium.dm-locked {
      position: relative;
    }
    
    .dm-lock-overlay {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 20px;
      text-align: center;
      color: #6b7280;
      gap: 8px;
    }
    
    .dm-lock-overlay svg {
      color: #9ca3af;
    }
    
    .dm-lock-overlay span {
      font-size: 12px;
    }
    
    .dm-sidebar-footer {
      padding: 16px;
      border-top: 1px solid #e5e7eb;
      background: #f9fafb;
    }
    
    .dm-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 10px 16px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      border: none;
    }
    
    .dm-btn-primary {
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
      color: white;
    }
    
    .dm-btn-primary:hover {
      background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);
    }
    
    .dm-btn-full {
      width: 100%;
    }
    
    .dm-btn-small {
      padding: 6px 12px;
      font-size: 12px;
    }
    
    .dm-footer-links {
      display: flex;
      justify-content: center;
      margin-top: 12px;
    }
    
    .dm-footer-links a {
      font-size: 12px;
      color: #6b7280;
      text-decoration: none;
    }
    
    .dm-footer-links a:hover {
      color: #3b82f6;
      text-decoration: underline;
    }
    
    .dm-saving {
      opacity: 0.7;
      pointer-events: none;
    }
    
    .dm-success-msg {
      background: #dcfce7;
      color: #166534;
      padding: 12px;
      border-radius: 8px;
      text-align: center;
      font-size: 13px;
      margin-bottom: 12px;
    }
    
    .dm-error-msg {
      background: #fee2e2;
      color: #dc2626;
      padding: 12px;
      border-radius: 8px;
      text-align: center;
      font-size: 13px;
      margin-bottom: 12px;
    }
  `
}

// Update sidebar content (after input changes)
function updateSidebar(): void {
  if (!sidebarElement) return
  sidebarElement.innerHTML = createSidebarHTML()
  attachEventListeners()
}

// Handle input changes
function handleInputChange(inputId: string, value: string | number): void {
  switch (inputId) {
    case 'dm-purchase-type':
      const newType = value as PurchaseType
      currentAssumptions.purchaseType = newType
      // Apply appropriate defaults
      if (newType === 'primary_residence') {
        currentAssumptions.maintenanceRate = 0.5
        currentAssumptions.capexRate = 0.5
        currentAssumptions.vacancyRate = 0
        currentAssumptions.managementRate = 0
      } else {
        currentAssumptions.maintenanceRate = INVESTMENT_ASSUMPTIONS.maintenanceRate || 8
        currentAssumptions.capexRate = INVESTMENT_ASSUMPTIONS.capexRate || 5
        currentAssumptions.vacancyRate = INVESTMENT_ASSUMPTIONS.vacancyRate || 5
        currentAssumptions.managementRate = INVESTMENT_ASSUMPTIONS.managementRate || 8
      }
      break
    case 'dm-down-payment':
      currentAssumptions.downPaymentPct = Number(value)
      break
    case 'dm-interest-rate':
      currentAssumptions.interestRate = Number(value)
      break
    case 'dm-loan-term':
      currentAssumptions.termYears = Number(value)
      break
    case 'dm-closing-costs':
      currentAssumptions.closingCostRate = Number(value)
      break
    case 'dm-vacancy':
      currentAssumptions.vacancyRate = Number(value)
      break
    case 'dm-management':
      currentAssumptions.managementRate = Number(value)
      break
    case 'dm-maintenance':
      currentAssumptions.maintenanceRate = Number(value)
      break
    case 'dm-capex':
      currentAssumptions.capexRate = Number(value)
      break
    case 'dm-rent':
      currentAssumptions.estimatedRent = Number(value)
      break
    case 'dm-holding-years':
      currentAssumptions.holdingPeriodYears = Math.max(1, Math.min(30, Number(value) || 5))
      break
    case 'dm-appreciation':
      currentAssumptions.appreciationRate = Number(value)
      break
    case 'dm-rent-growth':
      currentAssumptions.rentGrowthRate = Number(value)
      break
    case 'dm-expense-growth':
      currentAssumptions.expenseGrowthRate = Number(value)
      break
    case 'dm-selling-cost':
      currentAssumptions.sellingCostRate = Math.max(0, Number(value))
      break
  }
  
  updateSidebar()
}

/** Safely get deal ID from background save response. Uses optional chaining so never reads .id on undefined. */
function getDealIdFromSaveResponse(response: unknown): string | null {
  try {
    if (!response || typeof response !== 'object') return null
    const r = response as Record<string, unknown>
    const topDealId = r?.dealId
    if (typeof topDealId === 'string') return topDealId
    const data = r?.data
    if (data && typeof data === 'object') {
      const d = data as Record<string, unknown>
      const dataDealId = d?.dealId
      if (typeof dataDealId === 'string') return dataDealId
      const deal = d?.deal
      if (deal != null && typeof deal === 'object') {
        const id = (deal as Record<string, unknown>)?.id
        if (typeof id === 'string') return id
      }
    }
  } catch {
    return null
  }
  return null
}

// Handle save to dashboard
async function handleSaveDeal(): Promise<void> {
  if (!authToken) {
    alert('Please sign in to save deals')
    return
  }
  
  const saveBtn = document.getElementById('dm-save-deal')
  if (saveBtn) {
    saveBtn.classList.add('dm-saving')
    saveBtn.innerHTML = 'Saving...'
  }
  
  try {
    const payload = {
      zillowUrl: scrapedData.zillowUrl || window.location.href,
      extractedData: {
        address: scrapedData.address,
        city: scrapedData.city,
        state: scrapedData.state,
        zip: scrapedData.zip,
        propertyType: scrapedData.propertyType,
        beds: scrapedData.beds,
        baths: scrapedData.baths,
        sqft: scrapedData.sqft,
        yearBuilt: scrapedData.yearBuilt,
        listPrice: scrapedData.listPrice,
        hoaMonthly: scrapedData.hoaMonthly,
        taxesAnnual: scrapedData.taxesAnnual,
      },
      purchaseType: currentAssumptions.purchaseType,
      downPaymentPct: currentAssumptions.downPaymentPct,
      importedFields: Object.keys(scrapedData).filter(k => scrapedData[k as keyof ScrapedPropertyData] !== undefined),
      missingFields: [],
      fieldConfidences: {},
      extractorVersion: 'sidebar_v1',
    }
    
    // Send to background script to avoid CORS issues
    console.log('[DealMetrics] Saving deal...', { payload, hasToken: !!authToken })
    
    const response = await chrome.runtime.sendMessage({
      action: 'saveDeal',
      payload,
      authToken,
    })
    
    console.log('[DealMetrics] Save response:', response)
    
    if (!response) {
      throw new Error('No response from background script - extension may need reload')
    }
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to save deal')
    }

    // Extract dealId safely (never throw; if anything fails we still show success)
    let dealId: string | null = null
    try {
      dealId = getDealIdFromSaveResponse(response)
    } catch {
      dealId = null
    }
    if (!dealId) {
      console.warn('[DealMetrics] Save succeeded but dealId missing from response shape:', response)
    }

    // Show success message (dealId may be null; never read .id here)
    try {
      const content = document.querySelector('.dm-sidebar-content')
      if (content) {
        const successMsg = document.createElement('div')
        successMsg.className = 'dm-success-msg'
        const link = dealId
          ? `Deal saved! <a href="https://getdealmetrics.com/deals/${escapeHtml(dealId)}" target="_blank">View in Dashboard</a>`
          : 'Deal saved! <a href="https://getdealmetrics.com/dashboard" target="_blank">View in Dashboard</a>'
        successMsg.innerHTML = link
        content.insertBefore(successMsg, content.firstChild)
      }
    } catch (e) {
      console.error('[DealMetrics] Error showing success message:', e)
    }

    if (saveBtn) {
      saveBtn.innerHTML = 'Saved!'
      setTimeout(() => {
        if (saveBtn) {
          saveBtn.classList.remove('dm-saving')
          saveBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
              <polyline points="17 21 17 13 7 13 7 21"/>
              <polyline points="7 3 7 8 15 8"/>
            </svg>
            Save to Dashboard
          `
        }
      }, 2000)
    }
  } catch (error: any) {
    console.error('Save error:', error)
    
    const errorMessage = error.message || 'Failed to save deal'
    const isTokenError = errorMessage.toLowerCase().includes('token') || 
                         errorMessage.toLowerCase().includes('unauthorized') ||
                         errorMessage.toLowerCase().includes('401')
    
    // If token is expired/invalid, clear it and prompt re-login
    if (isTokenError) {
      await chrome.storage.sync.remove(['authToken', 'refreshToken', 'userEmail'])
      isLoggedIn = false
      authToken = null
    }
    
    const content = document.querySelector('.dm-sidebar-content')
    if (content) {
      const errorMsg = document.createElement('div')
      errorMsg.className = 'dm-error-msg'
      
      if (isTokenError) {
        errorMsg.innerHTML = `
          Session expired. <button id="dm-reauth-btn" style="color: #2563eb; text-decoration: underline; background: none; border: none; cursor: pointer;">Sign in again</button>
        `
      } else {
        errorMsg.textContent = errorMessage
      }
      content.insertBefore(errorMsg, content.firstChild)
      
      // Attach re-auth button handler
      if (isTokenError) {
        document.getElementById('dm-reauth-btn')?.addEventListener('click', () => {
          handleSignIn()
        })
      }
    }
    
    if (saveBtn) {
      saveBtn.classList.remove('dm-saving')
      saveBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
          <polyline points="17 21 17 13 7 13 7 21"/>
          <polyline points="7 3 7 8 15 8"/>
        </svg>
        Save to Dashboard
      `
    }
    
    // Refresh sidebar to show logged-out state if token was cleared
    if (isTokenError) {
      setTimeout(() => updateSidebar(), 500)
    }
  }
}

// Handle sign in
function handleSignIn(): void {
  const cacheBuster = Date.now()
  const authUrl = `https://getdealmetrics.com/auth/extension?_=${cacheBuster}`
  window.open(authUrl, '_blank')
}

// Attach event listeners
function attachEventListeners(): void {
  // Close button
  document.getElementById('dm-close-sidebar')?.addEventListener('click', () => {
    closeSidebar()
  })
  
  // Refresh button
  document.getElementById('dm-refresh-data')?.addEventListener('click', () => {
    refreshData()
  })
  
  // Toggle advanced
  document.getElementById('dm-toggle-advanced')?.addEventListener('click', () => {
    const advanced = document.getElementById('dm-advanced-inputs')
    if (advanced) {
      advanced.style.display = advanced.style.display === 'none' ? 'block' : 'none'
    }
  })
  
  // Input handlers
  const inputs = [
    'dm-purchase-type', 'dm-down-payment', 'dm-interest-rate', 'dm-loan-term',
    'dm-closing-costs', 'dm-vacancy', 'dm-management', 'dm-maintenance',
    'dm-capex', 'dm-rent',
    'dm-holding-years', 'dm-appreciation', 'dm-rent-growth', 'dm-expense-growth', 'dm-selling-cost'
  ]
  
  inputs.forEach(id => {
    const el = document.getElementById(id) as HTMLInputElement | HTMLSelectElement
    if (el) {
      el.addEventListener('change', () => {
        handleInputChange(id, el.value)
      })
    }
  })
  
  // Save button
  document.getElementById('dm-save-deal')?.addEventListener('click', handleSaveDeal)
  
  // Sign in buttons
  document.getElementById('dm-sign-in')?.addEventListener('click', handleSignIn)
  document.getElementById('dm-sign-in-footer')?.addEventListener('click', handleSignIn)
}

// Refresh scraped data
function refreshData(): void {
  const result = extractZillowData()
  const fields = result.fields
  
  // Determine if taxes are from actual history or estimated
  const taxSource = fields.taxesAnnual?.source
  const isActualTax = taxSource?.startsWith('tax-history') || taxSource === 'payment-breakdown'
  const taxYear = fields.taxYear?.value as number | undefined
  
  // Determine if insurance is from Zillow or estimated
  const insuranceSource = fields.insuranceAnnual?.source
  const isActualInsurance = insuranceSource === 'payment-breakdown'
  
  scrapedData = {
    address: fields.address?.value as string | undefined,
    city: fields.city?.value as string | undefined,
    state: fields.state?.value as string | undefined,
    zip: fields.zip?.value as string | undefined,
    listPrice: fields.listPrice?.value as number | undefined,
    beds: fields.beds?.value as number | undefined,
    baths: fields.baths?.value as number | undefined,
    sqft: fields.sqft?.value as number | undefined,
    propertyType: fields.propertyType?.value as string | undefined,
    yearBuilt: fields.yearBuilt?.value as number | undefined,
    hoaMonthly: fields.hoaMonthly?.value as number | undefined,
    taxesAnnual: fields.taxesAnnual?.value as number | undefined,
    taxYear: taxYear,
    taxSource: isActualTax ? 'actual' : 'estimated',
    insuranceAnnual: fields.insuranceAnnual?.value as number | undefined,
    insuranceSource: isActualInsurance ? 'actual' : 'estimated',
    zillowUrl: window.location.href,
  }
  updateSidebar()
}

// Close sidebar
export function closeSidebar(): void {
  if (sidebarElement) {
    sidebarElement.remove()
    sidebarElement = null
  }
}

// Check if sidebar is open
export function isSidebarOpen(): boolean {
  return sidebarElement !== null
}

// Open sidebar
export async function openSidebar(): Promise<void> {
  if (sidebarElement) return
  
  // Check auth status
  await checkAuthStatus()
  
  // Extract data from page
  refreshData()
  
  // Create style element
  const styleId = 'dealmetrics-sidebar-styles'
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style')
    style.id = styleId
    style.textContent = createSidebarStyles()
    document.head.appendChild(style)
  }
  
  // Create sidebar
  sidebarElement = document.createElement('div')
  sidebarElement.id = 'dealmetrics-sidebar'
  sidebarElement.innerHTML = createSidebarHTML()
  document.body.appendChild(sidebarElement)
  
  // Attach event listeners
  attachEventListeners()
}

// Toggle sidebar
export function toggleSidebar(): void {
  if (isSidebarOpen()) {
    closeSidebar()
  } else {
    openSidebar()
  }
}
