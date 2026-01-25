import { describe, it, expect } from 'vitest'
import {
  calculateMonthlyPI,
  calculateTotalMonthlyPayment,
  calculateNOI,
  calculateCashFlow,
  calculateCapRate,
  calculateCashOnCash,
  calculateDSCR,
  calculateBreakEvenRent,
  calculateAllInCashRequired,
  calculateUnderwriting,
} from '../engine'
import { UnderwritingInputs } from '@/lib/types'

describe('Underwriting Engine', () => {
  const baseInputs: UnderwritingInputs = {
    purchasePrice: 250000,
    closingCostRate: 3,
    rehabCost: 20000,
    downPaymentPct: 20,
    interestRate: 7,
    termYears: 30,
    pmiEnabled: false,
    pmiMonthly: 0,
    taxesAnnual: 3000,
    insuranceAnnual: 1200,
    hoaMonthly: 0,
    utilitiesMonthly: 100,
    rentMonthly: 2000,
    otherIncomeMonthly: 0,
    vacancyRate: 5,
    maintenanceRate: 8,
    capexRate: 5,
    managementRate: 8,
  }

  describe('calculateMonthlyPI', () => {
    it('calculates correct monthly P&I for standard loan', () => {
      const principal = 200000 // 80% of 250k
      const rate = 7
      const term = 30
      const payment = calculateMonthlyPI(principal, rate, term)
      
      // Should be approximately $1,331.29
      expect(payment).toBeCloseTo(1331.29, 2)
    })

    it('handles zero principal', () => {
      expect(calculateMonthlyPI(0, 7, 30)).toBe(0)
    })

    it('handles zero interest rate', () => {
      const principal = 200000
      const payment = calculateMonthlyPI(principal, 0, 30)
      expect(payment).toBeCloseTo(200000 / (30 * 12), 2)
    })
  })

  describe('calculateTotalMonthlyPayment', () => {
    it('includes all monthly costs', () => {
      const payment = calculateTotalMonthlyPayment(baseInputs)
      // Should include P&I + taxes + insurance + HOA + utilities
      expect(payment).toBeGreaterThan(1500)
    })
  })

  describe('calculateNOI', () => {
    it('calculates NOI correctly', () => {
      const noi = calculateNOI(baseInputs)
      expect(noi.monthly).toBeLessThan(baseInputs.rentMonthly)
      expect(noi.annual).toBe(noi.monthly * 12)
    })

    it('accounts for vacancy', () => {
      const noi = calculateNOI(baseInputs)
      // With 5% vacancy, effective income should be less than gross
      expect(noi.monthly).toBeLessThan(baseInputs.rentMonthly * 0.95)
    })
  })

  describe('calculateCashFlow', () => {
    it('calculates cash flow as NOI minus debt service', () => {
      const cashFlow = calculateCashFlow(baseInputs)
      const noi = calculateNOI(baseInputs)
      const totalPayment = calculateTotalMonthlyPayment(baseInputs)
      
      expect(cashFlow.monthly).toBeCloseTo(noi.monthly - totalPayment, 2)
    })
  })

  describe('calculateCapRate', () => {
    it('calculates cap rate as NOI annual / purchase price', () => {
      const capRate = calculateCapRate(baseInputs)
      const noi = calculateNOI(baseInputs)
      const expected = (noi.annual / baseInputs.purchasePrice) * 100
      
      expect(capRate).toBeCloseTo(expected, 2)
    })
  })

  describe('calculateCashOnCash', () => {
    it('calculates cash-on-cash return', () => {
      const coc = calculateCashOnCash(baseInputs)
      expect(coc).toBeGreaterThan(-100) // Should be reasonable
      expect(coc).toBeLessThan(1000) // Shouldn't be absurdly high
    })
  })

  describe('calculateDSCR', () => {
    it('calculates debt service coverage ratio', () => {
      const dscr = calculateDSCR(baseInputs)
      expect(dscr).toBeGreaterThan(0)
    })
  })

  describe('calculateBreakEvenRent', () => {
    it('calculates rent needed for zero cash flow', () => {
      const breakEven = calculateBreakEvenRent(baseInputs)
      expect(breakEven).toBeGreaterThan(0)
    })
  })

  describe('calculateAllInCashRequired', () => {
    it('includes down payment, closing costs, and rehab', () => {
      const allIn = calculateAllInCashRequired(baseInputs)
      const downPayment = baseInputs.purchasePrice * 0.2
      const closingCosts = baseInputs.purchasePrice * 0.03
      
      expect(allIn).toBe(downPayment + closingCosts + baseInputs.rehabCost)
    })
  })

  describe('calculateUnderwriting', () => {
    it('returns all calculated outputs', () => {
      const outputs = calculateUnderwriting(baseInputs)
      
      expect(outputs).toHaveProperty('totalMonthlyPayment')
      expect(outputs).toHaveProperty('noiMonthly')
      expect(outputs).toHaveProperty('noiAnnual')
      expect(outputs).toHaveProperty('cashFlowMonthly')
      expect(outputs).toHaveProperty('cashFlowAnnual')
      expect(outputs).toHaveProperty('capRate')
      expect(outputs).toHaveProperty('cashOnCash')
      expect(outputs).toHaveProperty('dscr')
      expect(outputs).toHaveProperty('breakEvenRentMonthly')
      expect(outputs).toHaveProperty('allInCashRequired')
    })

    it('produces consistent results', () => {
      const outputs1 = calculateUnderwriting(baseInputs)
      const outputs2 = calculateUnderwriting(baseInputs)
      
      expect(outputs1).toEqual(outputs2)
    })
  })
})
