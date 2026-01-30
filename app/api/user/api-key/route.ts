import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserId, generateApiKey } from '@/lib/auth'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// GET /api/user/api-key - Get current API key
export async function GET() {
  try {
    if (process.env.USE_SUPABASE !== 'true') {
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json(
          { error: 'API key service is unavailable' },
          { status: 503 }
        )
      }
      return NextResponse.json({ apiKey: 'dm_demo_key_for_local_development' })
    }

    const userId = await getCurrentUserId()
    
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set() {},
          remove() {},
        },
      }
    )

    const { data: profile } = await supabase
      .from('profiles')
      .select('api_key')
      .eq('id', userId)
      .single()

    return NextResponse.json({ apiKey: profile?.api_key || null })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error getting API key:', error)
    return NextResponse.json({ error: 'Failed to get API key' }, { status: 500 })
  }
}

// POST /api/user/api-key - Generate new API key
export async function POST() {
  try {
    if (process.env.USE_SUPABASE !== 'true') {
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json(
          { error: 'API key service is unavailable' },
          { status: 503 }
        )
      }
      return NextResponse.json({ apiKey: 'dm_demo_key_for_local_development' })
    }

    const userId = await getCurrentUserId()
    const newApiKey = generateApiKey()
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          get() { return undefined },
          set() {},
          remove() {},
        },
      }
    )

    await supabase
      .from('profiles')
      .update({ api_key: newApiKey, updated_at: new Date().toISOString() })
      .eq('id', userId)

    return NextResponse.json({ apiKey: newApiKey })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error generating API key:', error)
    return NextResponse.json(
      { error: process.env.NODE_ENV === 'production' ? 'Something went wrong' : 'Failed to generate API key' },
      { status: 500 }
    )
  }
}
