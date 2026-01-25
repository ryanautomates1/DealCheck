import { createClient } from '@/lib/supabase/server'
import { ShareLink } from '../types'
import { IShareRepository } from './json-share-repository'

function fromDbShare(row: Record<string, any>): ShareLink {
  return {
    token: row.token,
    dealId: row.deal_id,
    userId: row.user_id,
    createdAt: row.created_at,
    revoked: row.revoked,
  }
}

export class SupabaseShareRepository implements IShareRepository {
  async findByToken(token: string): Promise<ShareLink | null> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('share_links')
      .select('*')
      .eq('token', token)
      .eq('revoked', false)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw error
    }
    return data ? fromDbShare(data) : null
  }

  async findByDealId(dealId: string, userId: string): Promise<ShareLink | null> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('share_links')
      .select('*')
      .eq('deal_id', dealId)
      .eq('user_id', userId)
      .eq('revoked', false)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw error
    }
    return data ? fromDbShare(data) : null
  }

  async create(share: Omit<ShareLink, 'token' | 'createdAt'>): Promise<ShareLink> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('share_links')
      .insert({
        deal_id: share.dealId,
        user_id: share.userId,
        revoked: share.revoked,
      })
      .select()
      .single()

    if (error) throw error
    return fromDbShare(data)
  }

  async revoke(token: string, userId: string): Promise<void> {
    const supabase = createClient()
    const { error } = await supabase
      .from('share_links')
      .update({ revoked: true })
      .eq('token', token)
      .eq('user_id', userId)

    if (error) throw error
  }
}

export const supabaseShareRepository = new SupabaseShareRepository()
