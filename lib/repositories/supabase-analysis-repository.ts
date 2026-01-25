import { createClient } from '@/lib/supabase/server'
import { Analysis } from '../types'
import { IAnalysisRepository } from './json-analysis-repository'

function fromDbAnalysis(row: Record<string, any>): Analysis {
  return {
    id: row.id,
    dealId: row.deal_id,
    userId: row.user_id,
    createdAt: row.created_at,
    inputs: row.inputs,
    outputs: row.outputs,
    holdingPeriodOutputs: row.holding_period_outputs,
    assumptionsSnapshot: row.assumptions_snapshot || {},
    version: row.version || 'v1',
  }
}

export class SupabaseAnalysisRepository implements IAnalysisRepository {
  async findByDealId(dealId: string, userId: string): Promise<Analysis[]> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('analyses')
      .select('*')
      .eq('deal_id', dealId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data || []).map(fromDbAnalysis)
  }

  async create(analysis: Omit<Analysis, 'id' | 'createdAt'>): Promise<Analysis> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('analyses')
      .insert({
        deal_id: analysis.dealId,
        user_id: analysis.userId,
        inputs: analysis.inputs,
        outputs: analysis.outputs,
        holding_period_outputs: analysis.holdingPeriodOutputs,
        assumptions_snapshot: analysis.assumptionsSnapshot,
        version: analysis.version,
      })
      .select()
      .single()

    if (error) throw error
    return fromDbAnalysis(data)
  }

  async findById(id: string, userId: string): Promise<Analysis | null> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('analyses')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw error
    }
    return data ? fromDbAnalysis(data) : null
  }
}

export const supabaseAnalysisRepository = new SupabaseAnalysisRepository()
