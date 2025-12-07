import { NextRequest, NextResponse } from 'next/server';
import { searchTicker } from '@/lib/analysis/ticker-search';

/**
 * GET /api/search/ticker?q=tcs
 * Search for stock symbols dynamically from NSE
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query || query.length < 2) {
      return NextResponse.json({
        success: false,
        error: 'Query must be at least 2 characters'
      }, { status: 400 });
    }

    const results = await searchTicker(query);

    return NextResponse.json({
      success: true,
      query,
      results
    });
  } catch (error) {
    console.error('Ticker search error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Search failed'
      },
      { status: 500 }
    );
  }
}
