import { promises as fs } from 'fs'
import path from 'path'
import { ShareLink } from '../types'

const DATA_DIR = path.join(process.cwd(), 'data')
const SHARES_FILE = path.join(DATA_DIR, 'shares.json')
const LOCK_FILE = path.join(DATA_DIR, 'shares.lock')

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

async function readShares(): Promise<ShareLink[]> {
  await ensureDataDir()
  try {
    const data = await fs.readFile(SHARES_FILE, 'utf-8')
    return JSON.parse(data)
  } catch (error: any) {
    if (error.code === 'ENOENT') return []
    throw error
  }
}

async function writeShares(shares: ShareLink[]): Promise<void> {
  await ensureDataDir()
  await fs.writeFile(SHARES_FILE, JSON.stringify(shares, null, 2), 'utf-8')
}

export interface IShareRepository {
  findByToken(token: string): Promise<ShareLink | null>
  findByDealId(dealId: string, userId: string): Promise<ShareLink | null>
  create(share: Omit<ShareLink, 'token' | 'createdAt'>): Promise<ShareLink>
  revoke(token: string, userId: string): Promise<void>
}

export class JsonShareRepository implements IShareRepository {
  async findByToken(token: string): Promise<ShareLink | null> {
    return withLock(async () => {
      const shares = await readShares()
      const share = shares.find(s => s.token === token && !s.revoked)
      return share || null
    })
  }

  async findByDealId(dealId: string, userId: string): Promise<ShareLink | null> {
    return withLock(async () => {
      const shares = await readShares()
      return shares.find(s => s.dealId === dealId && s.userId === userId && !s.revoked) || null
    })
  }

  async create(share: Omit<ShareLink, 'token' | 'createdAt'>): Promise<ShareLink> {
    return withLock(async () => {
      const shares = await readShares()
      const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
      const newShare: ShareLink = {
        ...share,
        token,
        createdAt: new Date().toISOString(),
      }
      shares.push(newShare)
      await writeShares(shares)
      return newShare
    })
  }

  async revoke(token: string, userId: string): Promise<void> {
    return withLock(async () => {
      const shares = await readShares()
      const index = shares.findIndex(s => s.token === token && s.userId === userId)
      if (index !== -1) {
        shares[index].revoked = true
        await writeShares(shares)
      }
    })
  }
}

export const shareRepository = new JsonShareRepository()
