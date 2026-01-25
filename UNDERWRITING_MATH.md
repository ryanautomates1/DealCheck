# DealMetrics Underwriting Math Documentation (Revised)

This document describes the underwriting calculations used by DealMetrics to evaluate residential real estate deals. The goal is to produce conservative, internally consistent, and decision-oriented metrics suitable for deal screening.

All calculations are performed server-side.

## Overview

DealMetrics models real estate economics using industry-standard formulas. Calculations are based on monthly cash flows, with annualized values shown where appropriate.

**Key principles:**

- Payments ≠ true economic cost
- Operating performance is evaluated before financing
- Financing impact is evaluated after NOI
- Conservative defaults are used when data is missing

---

## Core Calculations

### 1. Monthly Principal & Interest (P&I)

Monthly loan payment is calculated using the standard mortgage amortization formula.

**Formula:**

```
Monthly P&I = (Loan Amount × r × (1 + r)^n) / ((1 + r)^n − 1)
```

Where:

- `Loan Amount` = Purchase Price − Down Payment
- `r` = Monthly Interest Rate (Annual Rate ÷ 12 ÷ 100)
- `n` = Loan Term in Months (Years × 12)

**Example:**

- Purchase Price: $300,000
- Down Payment: 20%
- Loan Amount: $240,000
- Interest Rate: 7%
- Term: 30 years

```
r = 0.005833
n = 360

Monthly P&I ≈ $1,597.05
```

---

### 2. Total Monthly Payment (Cash Obligation)

Total Monthly Payment represents cash paid out each month to service the property, excluding long-term reserves.

**Formula:**

```
Total Monthly Payment =
  P&I
+ PMI (if applicable)
+ Monthly Property Taxes
+ Monthly Insurance
+ HOA
+ Utilities (if owner-paid)
```

This metric answers: **"How much leaves my bank account every month?"**

**Example:**

```
P&I:           $1,597.05
Taxes:           $300.00
Insurance:        $87.50
HOA:             $150.00
Utilities:       $200.00

Total Monthly Payment = $2,334.55
```

---

### 3. Net Operating Income (NOI)

NOI measures the property's operating performance before financing.

**NOI explicitly excludes:**

- Mortgage payments
- PMI
- Principal repayment

#### Income

```
Gross Monthly Income =
  Rent
+ Other Income

Effective Income =
  Gross Income × (1 − Vacancy Rate)
```

#### Operating Expenses

Operating expenses include both fixed and variable costs.

```
Variable Expenses:
- Maintenance = Gross Rent × Maintenance %
- CapEx = Gross Rent × CapEx %
- Management = Gross Rent × Management %

Fixed Expenses:
- Property Taxes
- Insurance
- HOA
- Utilities (if applicable)
```

#### NOI Calculation

```
NOI Monthly =
  Effective Income
− Total Operating Expenses

NOI Annual = NOI Monthly × 12
```

**Example:**

```
Gross Rent:        $2,500
Vacancy (5%):      −$125
Effective Income:  $2,375

Maintenance (8%):  $200
CapEx (5%):        $125
Management (8%):   $200
Taxes:             $300
Insurance:          $87.50
HOA:               $150
Utilities:          $200

Operating Expenses: $1,262.50

NOI Monthly = $1,112.50
NOI Annual  = $13,350
```

---

### 4. Cash Flow (After Debt)

Cash flow measures true monthly surplus or deficit after financing.

```
Cash Flow =
  NOI
− Total Monthly Debt Service
```

Where:

- `Debt Service` = Monthly P&I (+ PMI if applicable)

**Example:**

```
NOI Monthly:           $1,112.50
Debt Service:          $1,597.05
Taxes/Insurance/HOA:   included in NOI

Cash Flow Monthly = −$484.55
Cash Flow Annual  = −$5,814.60
```

Negative cash flow indicates the property requires owner subsidy.

---

### 5. Capitalization Rate (Cap Rate)

Cap rate evaluates the property as if purchased with cash, ignoring financing.

```
Cap Rate = NOI Annual ÷ Purchase Price
```

**Example:**

```
$13,350 ÷ $300,000 = 4.45%
```

**Interpretation:**

- Cap rate may be negative if NOI is negative
- Cap rate is not meaningful for primary residences
- Best used for comparing investment properties in similar markets

---

### 6. Cash-on-Cash Return

Cash-on-cash return measures yield on actual cash invested.

```
All-In Cash =
  Down Payment
+ Closing Costs
+ Initial Rehab

Cash-on-Cash =
  Annual Cash Flow ÷ All-In Cash
```

**Example:**

```
All-In Cash:      $69,000
Annual Cash Flow: −$5,814.60

Cash-on-Cash = −8.43%
```

---

### 7. Debt Service Coverage Ratio (DSCR)

DSCR measures whether property income covers loan payments.

```
DSCR =
  NOI Annual ÷ Annual Debt Service
```

Where:

- `Annual Debt Service` = Monthly P&I × 12

**Example:**

```
$13,350 ÷ $19,164.60 = 0.70
```

**Interpretation:**

- DSCR < 1.0 → property does not support debt
- DSCR ≥ 1.25 → typical lender minimum
- DSCR is not used for primary residence underwriting

---

### 8. Break-Even Rent (Numerical Solve)

Break-even rent is calculated using a numerical solve, not a closed-form formula.

**Method:**

1. Increment rent upward
2. Recalculate NOI and cash flow
3. Identify rent where monthly cash flow ≈ 0

This approach:

- Handles PMI, utilities, other income, and edge cases correctly
- Avoids double-counting expenses
- Produces reliable results across scenarios

---

### 9. All-In Cash Required

```
All-In Cash =
  Down Payment
+ Closing Costs
+ Rehab
```

Future versions may optionally include reserve requirements.

---

## Assumptions & Defaults

When data is missing, DealMetrics applies conservative defaults:

| Item | Default |
|------|---------|
| Closing Costs | 3% of purchase price |
| Down Payment | 20% |
| Interest Rate | 7% |
| Loan Term | 30 years |
| Vacancy | 5% of gross rent |
| Maintenance | 8% of gross rent |
| CapEx | 5% of gross rent |
| Management | 8% of gross rent |
| Insurance | 0.35% of property value annually |
| Taxes | 1.2% of property value annually |
| Rent (fallback) | 0.8% of property value monthly |

Estimated values are clearly labeled and should be confirmed by the user.

---

## Purchase Type Treatment

| Purchase Type | Rental Income | Notes |
|---------------|---------------|-------|
| Primary Residence | $0 | Cap rate & DSCR de-emphasized |
| House Hack | Partial | Full investment math applies |
| Investment | Full | Standard underwriting |
| Vacation | Full | Assumptions may vary |
| Other | Full | Standard underwriting |

---

## Holding Period Analysis

For investment properties, DealMetrics provides multi-year projections to estimate total return over a holding period.

### Inputs

| Input | Default | Description |
|-------|---------|-------------|
| Holding Period | 10 years | How long you plan to hold the property |
| Appreciation Rate | 3% | Annual property value growth |
| Rent Growth Rate | 2% | Annual rent increase |
| Expense Growth Rate | 2% | Annual expense increase |
| Selling Costs | 6% | Costs at sale (realtor, closing) |

### Yearly Projection Calculations

For each year in the holding period:

```
Property Value (Year N) = Purchase Price × (1 + Appreciation Rate)^N

Rent (Year N) = Year 1 Rent × (1 + Rent Growth Rate)^(N-1)

Expenses (Year N) = Year 1 Expenses × (1 + Expense Growth Rate)^(N-1)

Loan Balance (Year N) = Calculated via amortization schedule

Equity (Year N) = Property Value - Loan Balance
```

### Amortization Schedule

Loan balance at any point is calculated using:

```
Balance after n payments = 
  Principal × [(1+r)^N - (1+r)^n] / [(1+r)^N - 1]
```

Where:
- `r` = Monthly interest rate
- `N` = Total payments (term × 12)
- `n` = Payments made (year × 12)

### Exit Scenario

When selling at end of holding period:

```
Sale Price = Property Value at Year N

Net Proceeds = 
  Sale Price
- Selling Costs (Sale Price × Selling Cost Rate)
- Loan Payoff (Remaining Balance)

Total Profit = 
  Net Proceeds
+ Cumulative Cash Flow
- Initial Investment
```

### Return Metrics

#### Internal Rate of Return (IRR)

IRR is the discount rate that makes NPV of all cash flows equal to zero.

Cash flows:
- Year 0: -Initial Investment
- Years 1 to N-1: Annual Cash Flow
- Year N: Annual Cash Flow + Net Sale Proceeds

Calculated using Newton-Raphson method with bisection fallback.

#### Equity Multiple

```
Equity Multiple = 
  (Cumulative Cash Flow + Net Sale Proceeds) / Initial Investment
```

Represents total return as a multiple of invested capital. 2.0x means you doubled your money.

#### Total ROI

```
Total ROI = (Total Profit / Initial Investment) × 100
```

#### Annualized ROI (CAGR)

```
Annualized ROI = 
  [(Final Value / Initial Investment)^(1/Years) - 1] × 100
```

Where Final Value = Initial Investment + Total Profit

### Example

**Assumptions:**
- Purchase Price: $300,000
- Down Payment: 20% ($60,000)
- Closing Costs: 3% ($9,000)
- Initial Investment: $69,000
- Holding Period: 10 years
- Appreciation: 3%/year
- Year 1 Cash Flow: $2,400

**Results:**
- Property Value (Year 10): $403,175
- Loan Balance (Year 10): $194,468
- Equity (Year 10): $208,707
- Cumulative Cash Flow: ~$30,000
- Net Sale Proceeds: ~$184,739
- Total Profit: ~$145,739
- IRR: ~13%
- Equity Multiple: ~3.1x

---

## Notes

- Calculations are performed monthly and annualized
- Percentages are stored as whole numbers
- Negative values are valid and informative
- Results are rounded for display only
- Underwriting logic is unit-tested
- Holding period analysis available for all property types (including primary residences)