import Stripe from 'stripe'

// Lazy initialization to avoid build-time errors when env vars aren't set
let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not set')
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
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

export const STRIPE_PRO_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID || ''
