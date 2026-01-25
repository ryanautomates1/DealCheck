import { IDealRepository } from './deal-repository.interface'
import { IAnalysisRepository } from './json-analysis-repository'
import { IShareRepository } from './json-share-repository'
import { IImportLogRepository } from './json-import-log-repository'

// JSON repositories (local file storage)
import { JsonDealRepository } from './json-deal-repository'
import { JsonAnalysisRepository } from './json-analysis-repository'
import { JsonShareRepository } from './json-share-repository'
import { JsonImportLogRepository } from './json-import-log-repository'

// Supabase repositories (PostgreSQL)
import { SupabaseDealRepository } from './supabase-deal-repository'
import { SupabaseAnalysisRepository } from './supabase-analysis-repository'
import { SupabaseShareRepository } from './supabase-share-repository'
import { SupabaseImportLogRepository } from './supabase-import-log-repository'

// Determine if we should use Supabase based on environment
const useSupabase = process.env.USE_SUPABASE === 'true'

// Export repository instances based on environment
export const dealRepository: IDealRepository = useSupabase
  ? new SupabaseDealRepository()
  : new JsonDealRepository()

export const analysisRepository: IAnalysisRepository = useSupabase
  ? new SupabaseAnalysisRepository()
  : new JsonAnalysisRepository()

export const shareRepository: IShareRepository = useSupabase
  ? new SupabaseShareRepository()
  : new JsonShareRepository()

export const importLogRepository: IImportLogRepository = useSupabase
  ? new SupabaseImportLogRepository()
  : new JsonImportLogRepository()

// Re-export interfaces for type usage
export type { IDealRepository } from './deal-repository.interface'
export type { IAnalysisRepository } from './json-analysis-repository'
export type { IShareRepository } from './json-share-repository'
export type { IImportLogRepository } from './json-import-log-repository'
