import { promises as fs } from 'fs'
import path from 'path'
import { Analysis } from '../types'

const DATA_DIR = path.join(process.cwd(), 'data')
const ANALYSES_FILE = path.join(DATA_DIR, 'analyses.json')
const LOCK_FILE = path.join(DATA_DIR, 'analyses.lock')

async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true })
  } catch (error) {}
}

async function withLock<T>(fn: () => Promise<T>): Promise<T> {
  await ensureDataDir()
  let attempts = 0
  const maxAttempts = 10
  const retryDelay = 50
  
  while (attempts < maxAttempts) {
    try {
      await fs.writeFile(LOCK_FILE, Date.now().toString(), { flag: 'wx' })
      try {
        const result = await fn()
        await fs.unlink(LOCK_FILE)
        return result
      } catch (error) {
        await fs.unlink(LOCK_FILE).catch(() => {})
        throw error
      }
    } catch (error: any) {
      if (error.code === 'EEXIST') {
        attempts++
        if (attempts >= maxAttempts) throw new Error('Failed to acquire lock')
        await new Promise(resolve => setTimeout(resolve, retryDelay))
      } else {
        throw error
      }
    }
  }
  throw new Error('Failed to acquire lock')
}

async function readAnalyses(): Promise<Analysis[]> {
  await ensureDataDir()
  try {
    const data = await fs.readFile(ANALYSES_FILE, 'utf-8')
    return JSON.parse(data)
  } catch (error: any) {
    if (error.code === 'ENOENT') return []
    throw error
  }
}

async function writeAnalyses(analyses: Analysis[]): Promise<void> {
  await ensureDataDir()
  await fs.writeFile(ANALYSES_FILE, JSON.stringify(analyses, null, 2), 'utf-8')
}

export interface IAnalysisRepository {
  findByDealId(dealId: string, userId: string): Promise<Analysis[]>
  create(analysis: Omit<Analysis, 'id' | 'createdAt'>): Promise<Analysis>
  findById(id: string, userId: string): Promise<Analysis | null>
}

export class JsonAnalysisRepository implements IAnalysisRepository {
  async findByDealId(dealId: string, userId: string): Promise<Analysis[]> {
    return withLock(async () => {
      const analyses = await readAnalyses()
      return analyses
        .filter(a => a.dealId === dealId && a.userId === userId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    })
  }

  async create(analysis: Omit<Analysis, 'id' | 'createdAt'>): Promise<Analysis> {
    return withLock(async () => {
      const analyses = await readAnalyses()
      const newAnalysis: Analysis = {
        ...analysis,
        id: `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date().toISOString(),
      }
      analyses.push(newAnalysis)
      await writeAnalyses(analyses)
      return newAnalysis
    })
  }

  async findById(id: string, userId: string): Promise<Analysis | null> {
    return withLock(async () => {
      const analyses = await readAnalyses()
      return analyses.find(a => a.id === id && a.userId === userId) || null
    })
  }
}

export const analysisRepository = new JsonAnalysisRepository()
