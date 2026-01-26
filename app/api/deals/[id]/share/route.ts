import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserId } from '@/lib/auth'
import { dealRepository, shareRepository } from '@/lib/repositories'

// Get the app URL from environment variable, fallback to request origin for local dev
function getAppUrl(request: NextRequest): string {
  // Always prefer the configured app URL in production
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (appUrl && appUrl !== 'http://localhost:3000') {
    return appUrl
  }
  // Fallback to request origin for local development
  return request.nextUrl.origin
}

// POST /api/deals/[id]/share
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getCurrentUserId()
    
    // Verify deal exists
    const deal = await dealRepository.findById(params.id, userId)
    if (!deal) {
      return NextResponse.json(
        { error: 'Deal not found' },
        { status: 404 }
      )
    }
    
    // Check if share link already exists
    let shareLink = await shareRepository.findByDealId(params.id, userId)
    
    if (!shareLink) {
      // Create new share link
      shareLink = await shareRepository.create({
        dealId: params.id,
        userId,
        revoked: false,
      })
    }
    
    const baseUrl = getAppUrl(request)
    return NextResponse.json({ 
      token: shareLink.token,
      url: `${baseUrl}/share/${shareLink.token}`,
    })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error creating share link:', error)
    return NextResponse.json(
      { error: 'Failed to create share link' },
      { status: 500 }
    )
  }
}
