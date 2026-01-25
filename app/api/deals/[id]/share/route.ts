import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserId } from '@/lib/auth'
import { dealRepository, shareRepository } from '@/lib/repositories'

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
    
    return NextResponse.json({ 
      token: shareLink.token,
      url: `${request.nextUrl.origin}/share/${shareLink.token}`,
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
