import { promises as fs } from 'fs'
import path from 'path'
import { ImportLog } from '../types'

const DATA_DIR = path.join(process.cwd(), 'data')
const IMPORT_LOGS_FILE = path.join(DATA_DIR, 'import-logs.json')
const LOCK_FILE = path.join(DATA_DIR, 'import-logs.lock')

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

async function readImportLogs(): Promise<ImportLog[]> {
  await ensureDataDir()
  try {
    const data = await fs.readFile(IMPORT_LOGS_FILE, 'utf-8')
    return JSON.parse(data)
  } catch (error: any) {
    if (error.code === 'ENOENT') return []
    throw error
  }
}

async function writeImportLogs(logs: ImportLog[]): Promise<void> {
  await ensureDataDir()
  await fs.writeFile(IMPORT_LOGS_FILE, JSON.stringify(logs, null, 2), 'utf-8')
}

export interface IImportLogRepository {
  create(log: Omit<ImportLog, 'id' | 'createdAt'>): Promise<ImportLog>
  findByDealId(dealId: string, userId: string): Promise<ImportLog[]>
}

export class JsonImportLogRepository implements IImportLogRepository {
  async create(log: Omit<ImportLog, 'id' | 'createdAt'>): Promise<ImportLog> {
    return withLock(async () => {
      const logs = await readImportLogs()
      const newLog: ImportLog = {
        ...log,
        id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date().toISOString(),
      }
      logs.push(newLog)
      await writeImportLogs(logs)
      return newLog
    })
  }

  async findByDealId(dealId: string, userId: string): Promise<ImportLog[]> {
    return withLock(async () => {
      const logs = await readImportLogs()
      return logs
        .filter(l => l.dealId === dealId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    })
  }
}

export const importLogRepository = new JsonImportLogRepository()
