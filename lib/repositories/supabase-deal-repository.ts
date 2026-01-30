import { createClient, createAdminClient } from '@/lib/supabase/server'
import { Deal } from '../types'
import { IDealRepository } from './deal-repository.interface'

// Convert camelCase Deal to snake_case for database (exported for import route admin path)
export function toDbDeal(deal: Partial<Deal>): Record<string, any> {
  const mapping: Record<string, string> = {
    userId: 'user_id',
    zillowUrl: 'zillow_url',
    propertyType: 'property_type',
    yearBuilt: 'year_built',
    listPrice: 'list_price',
    hoaMonthly: 'hoa_monthly',
    taxesAnnual: 'taxes_annual',
    importStatus: 'import_status',
    importedFields: 'imported_fields',
    missingFields: 'missing_fields',
    fieldConfidences: 'field_confidences',
    assumedFields: 'assumed_fields',
    purchaseType: 'purchase_type',
    purchasePrice: 'purchase_price',
    closingCostRate: 'closing_cost_rate',
    rehabCost: 'rehab_cost',
    downPaymentPct: 'down_payment_pct',
    interestRate: 'interest_rate',
    termYears: 'term_years',
    pmiEnabled: 'pmi_enabled',
    pmiMonthly: 'pmi_monthly',
    insuranceAnnual: 'insurance_annual',
    utilitiesMonthly: 'utilities_monthly',
    rentMonthly: 'rent_monthly',
    otherIncomeMonthly: 'other_income_monthly',
    numberOfUnits: 'number_of_units',
    rentPerUnit: 'rent_per_unit',
    vacancyRatePerUnit: 'vacancy_rate_per_unit',
    vacancyRate: 'vacancy_rate',
    maintenanceRate: 'maintenance_rate',
    capexRate: 'capex_rate',
    managementRate: 'management_rate',
    holdingPeriodYears: 'holding_period_years',
    appreciationRate: 'appreciation_rate',
    rentGrowthRate: 'rent_growth_rate',
    expenseGrowthRate: 'expense_growth_rate',
    sellingCostRate: 'selling_cost_rate',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }

  const dbDeal: Record<string, any> = {}
  for (const [key, value] of Object.entries(deal)) {
    if (key === 'id' || key === 'createdAt' || key === 'updatedAt') continue
    const dbKey = mapping[key] || key
    dbDeal[dbKey] = value
  }
  return dbDeal
}

// Convert snake_case database row to camelCase Deal (exported for import route admin path)
export function fromDbDeal(row: Record<string, any> | null | undefined): Deal {
  if (row == null) {
    throw new Error('fromDbDeal: row is null or undefined')
  }
  return {
    id: row.id,
    userId: row.user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    zillowUrl: row.zillow_url,
    address: row.address,
    city: row.city,
    state: row.state,
    zip: row.zip,
    propertyType: row.property_type,
    beds: row.beds,
    baths: row.baths,
    sqft: row.sqft,
    yearBuilt: row.year_built,
    listPrice: row.list_price,
    hoaMonthly: row.hoa_monthly,
    taxesAnnual: row.taxes_annual,
    importStatus: row.import_status,
    importedFields: row.imported_fields || [],
    missingFields: row.missing_fields || [],
    fieldConfidences: row.field_confidences || {},
    assumedFields: row.assumed_fields || [],
    purchaseType: row.purchase_type,
    purchasePrice: row.purchase_price,
    closingCostRate: row.closing_cost_rate,
    rehabCost: row.rehab_cost,
    downPaymentPct: row.down_payment_pct,
    interestRate: row.interest_rate,
    termYears: row.term_years,
    pmiEnabled: row.pmi_enabled ?? false,
    pmiMonthly: row.pmi_monthly,
    insuranceAnnual: row.insurance_annual,
    utilitiesMonthly: row.utilities_monthly,
    rentMonthly: row.rent_monthly,
    otherIncomeMonthly: row.other_income_monthly,
    numberOfUnits: row.number_of_units,
    rentPerUnit: row.rent_per_unit,
    vacancyRatePerUnit: row.vacancy_rate_per_unit,
    vacancyRate: row.vacancy_rate,
    maintenanceRate: row.maintenance_rate,
    capexRate: row.capex_rate,
    managementRate: row.management_rate,
    holdingPeriodYears: row.holding_period_years,
    appreciationRate: row.appreciation_rate,
    rentGrowthRate: row.rent_growth_rate,
    expenseGrowthRate: row.expense_growth_rate,
    sellingCostRate: row.selling_cost_rate,
    notes: row.notes,
  }
}

export class SupabaseDealRepository implements IDealRepository {
  async findAll(userId: string): Promise<Deal[]> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('deals')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })

    if (error) throw error
    return (data || []).map(fromDbDeal)
  }

  async findById(id: string, userId: string): Promise<Deal | null> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('deals')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null // Not found
      throw error
    }
    return data ? fromDbDeal(data) : null
  }

  async findByZillowUrl(zillowUrl: string, userId: string): Promise<Deal | null> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('deals')
      .select('*')
      .eq('zillow_url', zillowUrl)
      .eq('user_id', userId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null // Not found
      throw error
    }
    return data ? fromDbDeal(data) : null
  }

  async create(deal: Omit<Deal, 'id' | 'createdAt' | 'updatedAt'>): Promise<Deal> {
    return this.createWithClient(createClient(), deal)
  }

  /** Create deal using the given Supabase client (e.g. admin to bypass RLS when auth is Bearer token). */
  async createWithClient(supabase: ReturnType<typeof createClient>, deal: Omit<Deal, 'id' | 'createdAt' | 'updatedAt'>): Promise<Deal> {
    const dbDeal = toDbDeal(deal)
    const { data, error } = await supabase
      .from('deals')
      .insert(dbDeal)
      .select()
      .single()
    if (error) throw error
    if (!data) throw new Error('Database did not return the created deal')
    return fromDbDeal(data)
  }

  async update(id: string, userId: string, updates: Partial<Deal>): Promise<Deal> {
    return this.updateWithClient(createClient(), id, userId, updates)
  }

  /** Update deal using the given Supabase client (e.g. admin to bypass RLS when auth is Bearer token). */
  async updateWithClient(supabase: ReturnType<typeof createClient>, id: string, userId: string, updates: Partial<Deal>): Promise<Deal> {
    const dbUpdates = toDbDeal(updates)
    dbUpdates.updated_at = new Date().toISOString()
    const { data, error } = await supabase
      .from('deals')
      .update(dbUpdates)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()
    if (error) throw error
    if (data == null) throw new Error('Database did not return the updated deal')
    const updated = fromDbDeal(data)
    if (updated.id == null) throw new Error('Updated deal missing id')
    return updated
  }

  async delete(id: string, userId: string): Promise<void> {
    const supabase = createClient()
    const { error } = await supabase
      .from('deals')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) throw error
  }

  async search(userId: string, query: string): Promise<Deal[]> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('deals')
      .select('*')
      .eq('user_id', userId)
      .or(`address.ilike.%${query}%,zillow_url.ilike.%${query}%`)
      .order('updated_at', { ascending: false })

    if (error) throw error
    return (data || []).map(fromDbDeal)
  }
}

export const supabaseDealRepository = new SupabaseDealRepository()
