import { createClient, createAdminClient } from '@/lib/supabase/server'
import { ImportLog } from '../types'
import { IImportLogRepository } from './json-import-log-repository'

function fromDbImportLog(row: Record<string, any>): ImportLog {
  return {
    id: row.id,
    dealId: row.deal_id,
    createdAt: row.created_at,
    zillowUrl: row.zillow_url,
    result: row.result,
    missingFieldsCount: row.missing_fields_count,
    extractorVersion: row.extractor_version,
  }
}

export class SupabaseImportLogRepository implements IImportLogRepository {
  async create(log: Omit<ImportLog, 'id' | 'createdAt'>): Promise<ImportLog> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('import_logs')
      .insert({
        deal_id: log.dealId,
        zillow_url: log.zillowUrl,
        result: log.result,
        missing_fields_count: log.missingFieldsCount,
        extractor_version: log.extractorVersion,
      })
      .select()
      .single()

    if (error) throw error
    return fromDbImportLog(data)
  }

  async findByDealId(dealId: string, userId: string): Promise<ImportLog[]> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('import_logs')
      .select('*')
      .eq('deal_id', dealId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data || []).map(fromDbImportLog)
  }
}

export const supabaseImportLogRepository = new SupabaseImportLogRepository()
