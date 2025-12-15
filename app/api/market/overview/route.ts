import { NextRequest, NextResponse } from 'next/server';
import { getMarketOverview } from '@/lib/scrapers/live-market-poller';

/**
 * GET /api/market/overview
 * Get market indices overview (NIFTY 50, SENSEX, etc.)
 */
export async function GET(request: NextRequest) {
  try {
    // Add caching headers - revalidate every 30 seconds
    const headers = new Headers();
    headers.set('Cache-Control', 'public, max-age=30, s-maxage=30');

    const data = await getMarketOverview();

    if (!data) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch market overview' },
        { status: 500, headers }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data,
      },
      { headers }
    );
  } catch (error) {
    console.error('Market overview fetch error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch market overview',
      },
      { status: 500 }
    );
  }
}
