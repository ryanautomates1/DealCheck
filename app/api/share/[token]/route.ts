import { NextRequest, NextResponse } from 'next/server'
import { shareRepository, dealRepository, analysisRepository } from '@/lib/repositories'

// GET /api/share/[token] - Public route (no auth required)
export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const shareLink = await shareRepository.findByToken(params.token)
    
    if (!shareLink) {
      return NextResponse.json(
        { error: 'Share link not found or revoked' },
        { status: 404 }
      )
    }
    
    // Get deal
    const deal = await dealRepository.findById(shareLink.dealId, shareLink.userId)
    if (!deal) {
      return NextResponse.json(
        { error: 'Deal not found' },
        { status: 404 }
      )
    }
    
    // Get latest analysis
    const analyses = await analysisRepository.findByDealId(shareLink.dealId, shareLink.userId)
    const latestAnalysis = analyses.length > 0 ? analyses[0] : null
    
    return NextResponse.json({
      deal,
      analysis: latestAnalysis,
      shareLink,
    })
  } catch (error) {
    console.error('Error fetching share:', error)
    return NextResponse.json(
      { error: 'Failed to fetch share' },
      { status: 500 }
    )
  }
}
