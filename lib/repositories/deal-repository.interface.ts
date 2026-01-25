import { Deal } from '../types'

export interface IDealRepository {
  findAll(userId: string): Promise<Deal[]>
  findById(id: string, userId: string): Promise<Deal | null>
  findByZillowUrl(zillowUrl: string, userId: string): Promise<Deal | null>
  create(deal: Omit<Deal, 'id' | 'createdAt' | 'updatedAt'>): Promise<Deal>
  update(id: string, userId: string, updates: Partial<Deal>): Promise<Deal>
  delete(id: string, userId: string): Promise<void>
  search(userId: string, query: string): Promise<Deal[]>
}
