import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserId, getUserProfile } from '@/lib/auth'
import { stripe } from '@/lib/stripe'

// GET /api/subscription - Get current subscription status
export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    const profile = await getUserProfile()
    
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }
    
    let subscription = null
    
    if (profile.stripeSubscriptionId) {
      try {
        subscription = await stripe.subscriptions.retrieve(profile.stripeSubscriptionId)
      } catch (e) {
        // Subscription might be deleted
      }
    }
    
    return NextResponse.json({
      tier: profile.subscriptionTier,
      importsThisMonth: profile.importsThisMonth,
      importsResetAt: profile.importsResetAt,
      subscription: subscription ? {
        status: subscription.status,
        currentPeriodEnd: new Date((subscription as any).current_period_end * 1000).toISOString(),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      } : null,
    })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error fetching subscription:', error)
    return NextResponse.json(
      { error: 'Failed to fetch subscription' },
      { status: 500 }
    )
  }
}

// POST /api/subscription - Manage subscription (cancel, etc.)
export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    const profile = await getUserProfile()
    const body = await request.json()
    const { action } = body
    
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }
    
    if (!profile.stripeSubscriptionId) {
      return NextResponse.json({ error: 'No active subscription' }, { status: 400 })
    }
    
    if (action === 'cancel') {
      // Cancel at period end
      await stripe.subscriptions.update(profile.stripeSubscriptionId, {
        cancel_at_period_end: true,
      })
      
      return NextResponse.json({ success: true, message: 'Subscription will cancel at end of billing period' })
    }
    
    if (action === 'resume') {
      // Resume cancelled subscription
      await stripe.subscriptions.update(profile.stripeSubscriptionId, {
        cancel_at_period_end: false,
      })
      
      return NextResponse.json({ success: true, message: 'Subscription resumed' })
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error managing subscription:', error)
    return NextResponse.json(
      { error: 'Failed to manage subscription' },
      { status: 500 }
    )
  }
}
