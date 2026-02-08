import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserId, getUserProfile } from '@/lib/auth'
import { STRIPE_SECRET_KEY, STRIPE_PRO_PRICE_ID } from '@/lib/config'
import { getStripe, STRIPE_PRO_PRICE_ID as STRIPE_PRICE_ID } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'

// POST /api/checkout - Create Stripe checkout session
export async function POST(request: NextRequest) {
  try {
    // Check Stripe configuration (uses config so Amplify build-time secrets work at runtime)
    if (!STRIPE_SECRET_KEY?.trim()) {
      return NextResponse.json(
        { error: 'Stripe is not configured. Please add STRIPE_SECRET_KEY to your environment (and redeploy).' },
        { status: 503 }
      )
    }
    const priceId = STRIPE_PRICE_ID || STRIPE_PRO_PRICE_ID
    if (!priceId?.trim()) {
      return NextResponse.json(
        { error: 'Stripe is not configured. Please add STRIPE_PRO_PRICE_ID to your environment (and redeploy).' },
        { status: 503 }
      )
    }

    // Must be authenticated
    const userId = await getCurrentUserId()
    const profile = await getUserProfile()
    
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }
    
    // Already a Pro user?
    if (profile.subscriptionTier === 'pro') {
      return NextResponse.json(
        { error: 'Already subscribed to Pro' },
        { status: 400 }
      )
    }
    
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const stripe = getStripe()
    
    // Create or get Stripe customer
    let customerId = profile.stripeCustomerId
    
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: profile.email,
        metadata: {
          supabase_user_id: userId,
        },
      })
      customerId = customer.id
      
      // Save customer ID to profile (only works if using Supabase)
      if (process.env.USE_SUPABASE === 'true') {
        const supabase = createClient()
        await supabase
          .from('profiles')
          .update({ stripe_customer_id: customerId })
          .eq('id', userId)
      }
    }
    
    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: STRIPE_PRO_PRICE_ID,
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/dashboard?upgraded=true`,
      cancel_url: `${appUrl}/pricing?cancelled=true`,
      subscription_data: {
        metadata: {
          supabase_user_id: userId,
        },
      },
    })
    
    return NextResponse.json({ url: session.url })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error creating checkout session:', error)
    // Surface Stripe-related errors so you can fix config (e.g. invalid key or price ID)
    const isStripeError = error?.type?.startsWith('Stripe') || error?.code != null
    const message = isStripeError && error?.message
      ? `Stripe error: ${error.message}`
      : process.env.NODE_ENV === 'production'
        ? 'Something went wrong. Please check that Stripe is configured (STRIPE_SECRET_KEY, STRIPE_PRO_PRICE_ID).'
        : error?.message || 'Failed to create checkout session'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
