import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

/**
 * Get the current user ID.
 * Returns the authenticated user's ID if using Supabase,
 * otherwise returns a demo user ID for local development.
 */
export async function getCurrentUserId(): Promise<string> {
  // If not using Supabase, return demo user
  if (process.env.USE_SUPABASE !== 'true') {
    return 'user_demo'
  }

  // Get user from Supabase session
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

  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    throw new Error('Unauthorized')
  }

  return user.id
}

/**
 * Check if user is authenticated (for routes that need optional auth)
 */
export async function isAuthenticated(): Promise<boolean> {
  if (process.env.USE_SUPABASE !== 'true') {
    return true // Always authenticated in local mode
  }

  try {
    await getCurrentUserId()
    return true
  } catch {
    return false
  }
}

/**
 * Get user profile including subscription info
 */
export interface UserProfile {
  id: string
  email: string
  subscriptionTier: 'free' | 'pro'
  importsThisMonth: number
  importsResetAt: string
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
}

export async function getUserProfile(): Promise<UserProfile | null> {
  if (process.env.USE_SUPABASE !== 'true') {
    // Return mock profile for local dev
    return {
      id: 'user_demo',
      email: 'demo@example.com',
      subscriptionTier: 'pro', // Unlimited in local dev
      importsThisMonth: 0,
      importsResetAt: new Date().toISOString(),
      stripeCustomerId: null,
      stripeSubscriptionId: null,
    }
  }

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

  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return null
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return null
  }

  return {
    id: profile.id,
    email: profile.email,
    subscriptionTier: profile.subscription_tier,
    importsThisMonth: profile.imports_this_month,
    importsResetAt: profile.imports_reset_at,
    stripeCustomerId: profile.stripe_customer_id,
    stripeSubscriptionId: profile.stripe_subscription_id,
  }
}

/**
 * Check and update import count for free tier limits
 * Returns true if import is allowed, false if limit reached
 */
export async function checkAndIncrementImportCount(): Promise<{ allowed: boolean; remaining: number }> {
  if (process.env.USE_SUPABASE !== 'true') {
    return { allowed: true, remaining: 999 } // Unlimited in local dev
  }

  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // Use service role to bypass RLS for update
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

  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    throw new Error('Unauthorized')
  }

  // Get current profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) {
    throw new Error('Profile not found')
  }

  // Pro users have unlimited imports
  if (profile.subscription_tier === 'pro') {
    return { allowed: true, remaining: 999 }
  }

  // Check if we need to reset the counter (new month)
  const resetDate = new Date(profile.imports_reset_at)
  const now = new Date()
  const needsReset = now.getMonth() !== resetDate.getMonth() || now.getFullYear() !== resetDate.getFullYear()

  if (needsReset) {
    // Reset counter for new month
    await supabase
      .from('profiles')
      .update({
        imports_this_month: 1,
        imports_reset_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('id', user.id)

    return { allowed: true, remaining: 1 } // 1 remaining after this import
  }

  // Check if limit reached (2 imports per month for free tier)
  const FREE_TIER_LIMIT = 2
  if (profile.imports_this_month >= FREE_TIER_LIMIT) {
    return { allowed: false, remaining: 0 }
  }

  // Increment counter
  const newCount = profile.imports_this_month + 1
  await supabase
    .from('profiles')
    .update({
      imports_this_month: newCount,
      updated_at: now.toISOString(),
    })
    .eq('id', user.id)

  return { allowed: true, remaining: FREE_TIER_LIMIT - newCount }
}
