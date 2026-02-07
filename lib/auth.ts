import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import crypto from 'crypto'
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } from './config'

/**
 * Check if we should use Supabase (always true in production)
 */
function shouldUseSupabase(): boolean {
  // Always use Supabase in production (AWS Amplify)
  if (process.env.NODE_ENV === 'production') {
    return true
  }
  return process.env.USE_SUPABASE === 'true'
}

/**
 * Get the current user ID.
 * Returns the authenticated user's ID if using Supabase,
 * otherwise returns a demo user ID for local development.
 */
export async function getCurrentUserId(): Promise<string> {
  // If not using Supabase, return demo user
  if (!shouldUseSupabase()) {
    return 'user_demo'
  }

  // Get user from Supabase session
  const cookieStore = cookies()
  const supabase = createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
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
 * Validate API key and return user ID
 */
export async function getUserIdFromApiKey(apiKey: string): Promise<string> {
  if (!shouldUseSupabase()) {
    return 'user_demo'
  }

  const supabase = createServerClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    {
      cookies: {
        get() { return undefined },
        set() {},
        remove() {},
      },
    }
  )

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('api_key', apiKey)
    .single()

  if (!profile) {
    throw new Error('Invalid API key')
  }

  return profile.id
}

/**
 * Validate JWT token (from extension auth) and return user ID
 */
export async function getUserIdFromToken(token: string): Promise<string> {
  if (!shouldUseSupabase()) {
    return 'user_demo'
  }

  const supabase = createServerClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    {
      cookies: {
        get() { return undefined },
        set() {},
        remove() {},
      },
    }
  )

  // Verify the JWT token with Supabase
  const { data: { user }, error } = await supabase.auth.getUser(token)

  if (error || !user) {
    throw new Error('Invalid or expired token')
  }

  return user.id
}

/**
 * Generate a new API key
 */
export function generateApiKey(): string {
  return `dm_${crypto.randomBytes(24).toString('hex')}`
}

/**
 * Check if user is authenticated (for routes that need optional auth)
 */
export async function isAuthenticated(): Promise<boolean> {
  if (!shouldUseSupabase()) {
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
  if (!shouldUseSupabase()) {
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
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
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
export async function checkAndIncrementImportCount(userId?: string): Promise<{ allowed: boolean; remaining: number }> {
  if (!shouldUseSupabase()) {
    return { allowed: true, remaining: 999 } // Unlimited in local dev
  }

  const supabase = createServerClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY, // Use service role to bypass RLS for update
    {
      cookies: {
        get() { return undefined },
        set() {},
        remove() {},
      },
    }
  )

  // Get user ID if not provided
  let targetUserId = userId
  if (!targetUserId) {
    const cookieStore = cookies()
    const sessionSupabase = createServerClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
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
    const { data: { user } } = await sessionSupabase.auth.getUser()
    if (!user) {
      throw new Error('Unauthorized')
    }
    targetUserId = user.id
  }

  // Get current profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', targetUserId)
    .single()

  if (!profile) {
    throw new Error('Profile not found')
  }

  // Pro users have unlimited imports
  if (profile.subscription_tier === 'pro') {
    return { allowed: true, remaining: 999 }
  }

  // Free tier: zero extension imports (Upgrade to Save)
  return { allowed: false, remaining: 0 }
}
