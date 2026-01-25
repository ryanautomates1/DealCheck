import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserId } from '@/lib/auth'
import { shareRepository } from '@/lib/repositories'

// POST /api/deals/[id]/share/revoke
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getCurrentUserId()
    const body = await request.json()
    const { token } = body
    
    if (!token) {
      return NextResponse.json(
        { error: 'Token required' },
        { status: 400 }
      )
    }
    
    await shareRepository.revoke(token, userId)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error revoking share link:', error)
    return NextResponse.json(
      { error: 'Failed to revoke share link' },
      { status: 500 }
    )
  }
}
