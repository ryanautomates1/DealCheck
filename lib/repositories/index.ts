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

// Lazy-initialized repository instances
let _dealRepository: IDealRepository | null = null
let _analysisRepository: IAnalysisRepository | null = null
let _shareRepository: IShareRepository | null = null
let _importLogRepository: IImportLogRepository | null = null

// Check at runtime if we should use Supabase
function shouldUseSupabase(): boolean {
  // Always use Supabase in production (AWS Amplify has read-only filesystem)
  if (process.env.NODE_ENV === 'production') {
    return true
  }
  return process.env.USE_SUPABASE === 'true'
}

// Getters that create repository instances on first access (runtime)
export const dealRepository: IDealRepository = {
  findAll: (...args) => getOrCreateDealRepo().findAll(...args),
  findById: (...args) => getOrCreateDealRepo().findById(...args),
  findByZillowUrl: (...args) => getOrCreateDealRepo().findByZillowUrl(...args),
  create: (...args) => getOrCreateDealRepo().create(...args),
  update: (...args) => getOrCreateDealRepo().update(...args),
  delete: (...args) => getOrCreateDealRepo().delete(...args),
  search: (...args) => getOrCreateDealRepo().search(...args),
}

export const analysisRepository: IAnalysisRepository = {
  findByDealId: (...args) => getOrCreateAnalysisRepo().findByDealId(...args),
  findById: (...args) => getOrCreateAnalysisRepo().findById(...args),
  create: (...args) => getOrCreateAnalysisRepo().create(...args),
}

export const shareRepository: IShareRepository = {
  findByToken: (...args) => getOrCreateShareRepo().findByToken(...args),
  findByDealId: (...args) => getOrCreateShareRepo().findByDealId(...args),
  create: (...args) => getOrCreateShareRepo().create(...args),
  revoke: (...args) => getOrCreateShareRepo().revoke(...args),
}

export const importLogRepository: IImportLogRepository = {
  findByDealId: (...args) => getOrCreateImportLogRepo().findByDealId(...args),
  create: (...args) => getOrCreateImportLogRepo().create(...args),
}

function getOrCreateDealRepo(): IDealRepository {
  if (!_dealRepository) {
    _dealRepository = shouldUseSupabase()
      ? new SupabaseDealRepository()
      : new JsonDealRepository()
  }
  return _dealRepository
}

function getOrCreateAnalysisRepo(): IAnalysisRepository {
  if (!_analysisRepository) {
    _analysisRepository = shouldUseSupabase()
      ? new SupabaseAnalysisRepository()
      : new JsonAnalysisRepository()
  }
  return _analysisRepository
}

function getOrCreateShareRepo(): IShareRepository {
  if (!_shareRepository) {
    _shareRepository = shouldUseSupabase()
      ? new SupabaseShareRepository()
      : new JsonShareRepository()
  }
  return _shareRepository
}

function getOrCreateImportLogRepo(): IImportLogRepository {
  if (!_importLogRepository) {
    _importLogRepository = shouldUseSupabase()
      ? new SupabaseImportLogRepository()
      : new JsonImportLogRepository()
  }
  return _importLogRepository
}

// Re-export interfaces for type usage
export type { IDealRepository } from './deal-repository.interface'
export type { IAnalysisRepository } from './json-analysis-repository'
export type { IShareRepository } from './json-share-repository'
export type { IImportLogRepository } from './json-import-log-repository'
