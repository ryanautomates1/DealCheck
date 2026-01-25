import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

// Error object for when Supabase is not configured
const notConfiguredError = { 
  message: 'Supabase is not configured. Please check your environment variables (NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY).',
  status: 500 
}

// Mock client that returns errors when Supabase is not configured
// This makes it obvious when env vars are missing rather than silently failing
const mockClient = {
  auth: {
    getSession: async () => ({ data: { session: null as any }, error: null }),
    getUser: async () => ({ data: { user: null as any }, error: null }),
    signInWithPassword: async () => ({ 
      data: { user: null as any, session: null as any }, 
      error: notConfiguredError 
    }),
    signUp: async () => ({ 
      data: { user: null as any, session: null as any }, 
      error: notConfiguredError 
    }),
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
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/3be8fdc6-e883-4d62-946c-40ea54a654da',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'client.ts:createClient',message:'Checking env vars',data:{urlType:typeof url,urlValue:url?url.substring(0,30):'UNDEFINED',urlLength:url?.length,keyType:typeof key,keyExists:!!key,keyLength:key?.length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A-B'})}).catch(()=>{});
  // #endregion
  
  if (!url || !key) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3be8fdc6-e883-4d62-946c-40ea54a654da',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'client.ts:mockBranch',message:'Using mock client - env vars missing',data:{urlFalsy:!url,keyFalsy:!key,urlIsEmptyString:url==='',keyIsEmptyString:key===''},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    console.warn('[Supabase] Environment variables not configured. Using mock client.')
    console.warn('[Supabase] NEXT_PUBLIC_SUPABASE_URL:', url ? 'SET' : 'MISSING')
    console.warn('[Supabase] NEXT_PUBLIC_SUPABASE_ANON_KEY:', key ? 'SET' : 'MISSING')
    return mockClient
  }
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/3be8fdc6-e883-4d62-946c-40ea54a654da',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'client.ts:realClient',message:'Creating real Supabase client',data:{urlPrefix:url.substring(0,30)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A-B'})}).catch(()=>{});
  // #endregion
  
  return createBrowserClient(url, key)
}
