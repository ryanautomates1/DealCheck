import { NextRequest, NextResponse } from 'next/server'
import { getUserIdFromToken } from '@/lib/auth'
import { createServerClient } from '@supabase/ssr'

// GET /api/user/profile - Get user profile for extension
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization required' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)

    // For local dev mode
    if (process.env.USE_SUPABASE !== 'true') {
      return NextResponse.json({
        id: 'user_demo',
        email: 'demo@example.com',
        subscriptionTier: 'pro',
        importsThisMonth: 0,
        importsRemaining: 999,
      })
    }

    // Verify token and get user
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

    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error || !user) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      )
    }

    // Get profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      )
    }

    // Calculate remaining imports
    const FREE_TIER_LIMIT = 2
    const importsRemaining = profile.subscription_tier === 'pro' 
      ? 999 
      : Math.max(0, FREE_TIER_LIMIT - profile.imports_this_month)

    return NextResponse.json({
      id: profile.id,
      email: profile.email,
      subscriptionTier: profile.subscription_tier,
      importsThisMonth: profile.imports_this_month,
      importsRemaining,
    })
  } catch (error: any) {
    console.error('Error fetching profile:', error)
    return NextResponse.json(
      { error: process.env.NODE_ENV === 'production' ? 'Something went wrong' : 'Failed to fetch profile' },
      { status: 500 }
    )
  }
}
