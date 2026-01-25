import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

// Mock client for when Supabase is not configured
const mockClient = {
  auth: {
    getSession: async () => ({ data: { session: null as any }, error: null }),
    getUser: async () => ({ data: { user: null as any }, error: null }),
    signInWithPassword: async () => ({ data: { user: null as any, session: null as any }, error: null }),
    signUp: async () => ({ data: { user: null as any, session: null as any }, error: null }),
    signOut: async () => ({ error: null }),
    onAuthStateChange: (_callback: any) => ({ data: { subscription: { unsubscribe: () => {} } } }),
    exchangeCodeForSession: async () => ({ data: { session: null as any }, error: null }),
  },
  from: (_table: string) => ({
    select: (_columns?: string) => ({
      eq: (_column: string, _value: any) => ({
        single: async () => ({ data: null, error: null }),
        order: () => ({ data: [], error: null }),
      }),
      order: () => ({ data: [], error: null }),
    }),
    insert: (_data: any) => ({
      select: () => ({
        single: async () => ({ data: null, error: null }),
      }),
    }),
    update: (_data: any) => ({
      eq: (_column: string, _value: any) => ({
        select: () => ({
          single: async () => ({ data: null, error: null }),
        }),
      }),
    }),
    delete: () => ({
      eq: (_column: string, _value: any) => ({ error: null }),
    }),
  }),
} as unknown as SupabaseClient

export function createClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!url || !key) {
    // Return a mock client for build time or local dev without Supabase
    return mockClient
  }
  
  return createBrowserClient(url, key)
}
