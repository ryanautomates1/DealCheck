import { promises as fs } from 'fs'
import path from 'path'
import { Deal } from '../types'
import { IDealRepository } from './deal-repository.interface'

const DATA_DIR = path.join(process.cwd(), 'data')
const DEALS_FILE = path.join(DATA_DIR, 'deals.json')
const LOCK_FILE = path.join(DATA_DIR, 'deals.lock')

async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true })
  } catch (error) {
    // Directory might already exist
  }
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
        if (attempts >= maxAttempts) {
          throw new Error('Failed to acquire lock after maximum attempts')
        }
        await new Promise(resolve => setTimeout(resolve, retryDelay))
      } else {
        throw error
      }
    }
  }
  
  throw new Error('Failed to acquire lock')
}

async function readDeals(): Promise<Deal[]> {
  await ensureDataDir()
  
  try {
    const data = await fs.readFile(DEALS_FILE, 'utf-8')
    return JSON.parse(data)
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return []
    }
    throw error
  }
}

async function writeDeals(deals: Deal[]): Promise<void> {
  await ensureDataDir()
  await fs.writeFile(DEALS_FILE, JSON.stringify(deals, null, 2), 'utf-8')
}

export class JsonDealRepository implements IDealRepository {
  async findAll(userId: string): Promise<Deal[]> {
    return withLock(async () => {
      const deals = await readDeals()
      return deals.filter(deal => deal.userId === userId).sort((a, b) => 
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )
    })
  }

  async findById(id: string, userId: string): Promise<Deal | null> {
    return withLock(async () => {
      const deals = await readDeals()
      const deal = deals.find(d => d.id === id && d.userId === userId)
      return deal || null
    })
  }

  async findByZillowUrl(zillowUrl: string, userId: string): Promise<Deal | null> {
    return withLock(async () => {
      const deals = await readDeals()
      const deal = deals.find(d => d.zillowUrl === zillowUrl && d.userId === userId)
      return deal || null
    })
  }

  async create(deal: Omit<Deal, 'id' | 'createdAt' | 'updatedAt'>): Promise<Deal> {
    return withLock(async () => {
      const deals = await readDeals()
      const now = new Date().toISOString()
      const newDeal: Deal = {
        ...deal,
        id: `deal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: now,
        updatedAt: now,
      }
      deals.push(newDeal)
      await writeDeals(deals)
      return newDeal
    })
  }

  async update(id: string, userId: string, updates: Partial<Deal>): Promise<Deal> {
    return withLock(async () => {
      const deals = await readDeals()
      const index = deals.findIndex(d => d.id === id && d.userId === userId)
      
      if (index === -1) {
        throw new Error(`Deal with id ${id} not found`)
      }
      
      deals[index] = {
        ...deals[index],
        ...updates,
        updatedAt: new Date().toISOString(),
      }
      
      await writeDeals(deals)
      return deals[index]
    })
  }

  async delete(id: string, userId: string): Promise<void> {
    return withLock(async () => {
      const deals = await readDeals()
      const filtered = deals.filter(d => !(d.id === id && d.userId === userId))
      await writeDeals(filtered)
    })
  }

  async search(userId: string, query: string): Promise<Deal[]> {
    return withLock(async () => {
      const deals = await readDeals()
      const lowerQuery = query.toLowerCase()
      return deals
        .filter(deal => deal.userId === userId)
        .filter(deal => {
          const addressMatch = deal.address?.toLowerCase().includes(lowerQuery)
          const urlMatch = deal.zillowUrl?.toLowerCase().includes(lowerQuery)
          return addressMatch || urlMatch
        })
        .sort((a, b) => 
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )
    })
  }
}

export const dealRepository = new JsonDealRepository()
