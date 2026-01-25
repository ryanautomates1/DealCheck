import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/server'
import Stripe from 'stripe'

// Disable body parsing to get raw body for webhook signature verification
export const runtime = 'nodejs'

async function updateUserSubscription(
  customerId: string,
  subscriptionId: string | null,
  subscriptionTier: 'free' | 'pro'
) {
  const supabase = createAdminClient()
  
  // Find user by Stripe customer ID
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single()
  
  if (!profile) {
    console.error(`No profile found for Stripe customer: ${customerId}`)
    return
  }
  
  // Update subscription info
  await supabase
    .from('profiles')
    .update({
      stripe_subscription_id: subscriptionId,
      subscription_tier: subscriptionTier,
      updated_at: new Date().toISOString(),
    })
    .eq('id', profile.id)
  
  console.log(`Updated user ${profile.id} to ${subscriptionTier} tier`)
}

// POST /api/webhooks/stripe
export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')
  
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }
  
  let event: Stripe.Event
  
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }
  
  console.log(`Received Stripe webhook: ${event.type}`)
  
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        
        if (session.mode === 'subscription' && session.subscription && session.customer) {
          await updateUserSubscription(
            session.customer as string,
            session.subscription as string,
            'pro'
          )
        }
        break
      }
      
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string
        
        // Check if subscription is active
        const isActive = ['active', 'trialing'].includes(subscription.status)
        
        await updateUserSubscription(
          customerId,
          subscription.id,
          isActive ? 'pro' : 'free'
        )
        break
      }
      
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string
        
        // Downgrade to free tier
        await updateUserSubscription(customerId, null, 'free')
        break
      }
      
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        console.warn(`Payment failed for customer: ${invoice.customer}`)
        // Could send email notification here
        break
      }
      
      default:
        console.log(`Unhandled event type: ${event.type}`)
    }
    
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Error processing webhook:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}
