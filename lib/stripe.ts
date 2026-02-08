import Stripe from 'stripe'
import { STRIPE_SECRET_KEY as CONFIG_STRIPE_SECRET_KEY, STRIPE_PRO_PRICE_ID as CONFIG_STRIPE_PRO_PRICE_ID } from './config'

// Lazy initialization; uses config so Amplify build-time secrets (generated-secrets.ts) work at runtime
let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = CONFIG_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY is not set')
    }
    _stripe = new Stripe(key, {
      apiVersion: '2025-12-15.clover',
      typescript: true,
    })
  }
  return _stripe
}

// Alias for backwards compatibility
export const stripe = new Proxy({} as Stripe, {
  get: (_, prop) => {
    return (getStripe() as any)[prop]
  },
})

// Use config so Amplify baked-in secrets are used at runtime
export const STRIPE_PRO_PRICE_ID = CONFIG_STRIPE_PRO_PRICE_ID || process.env.STRIPE_PRO_PRICE_ID || ''
