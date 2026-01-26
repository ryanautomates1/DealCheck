/**
 * Server-side configuration
 * These values are needed at runtime for server-side code
 */

// Supabase configuration
// In production, these are hardcoded because Amplify env vars aren't reliably passed to runtime
export const SUPABASE_URL = 
  process.env.NEXT_PUBLIC_SUPABASE_URL || 
  'https://zgysztqjsocznebtojbr.supabase.co'

export const SUPABASE_ANON_KEY = 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpneXN6dHFqc29jem5lYnRvamJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzMzAzNjUsImV4cCI6MjA4NDkwNjM2NX0.O5VqCpiygA2UAX6Oyv5TzWzYP9JLJvts6MSfBmLXKZY'

// Service role key must come from environment (it's a secret)
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// App URL
export const APP_URL = 
  process.env.NEXT_PUBLIC_APP_URL || 
  'https://getdealmetrics.com'

// Stripe (public key can be hardcoded, secret must come from env)
export const STRIPE_PUBLISHABLE_KEY = 
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || 
  'pk_live_51StToJD5YZN6jXngDqtzuJUUUNkVvK2QY2H5g2bVOKVN1HHI672D8ZYkV5mDwKHF8exSIQjO7et9W6pvqZzUD73m00YmsHuDWl'

export const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || ''
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || ''
export const STRIPE_PRO_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID || ''
