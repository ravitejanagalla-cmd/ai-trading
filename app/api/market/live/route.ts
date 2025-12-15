import { NextRequest, NextResponse } from 'next/server';
import { getLiveMarketData, batchGetLiveMarketData } from '@/lib/scrapers/live-market-poller';

/**
 * GET /api/market/live?symbol=TCS
 * or POST with { symbols: ['TCS', 'RELIANCE', ...] }
 */
export async function GET(request: NextRequest) {
  try {
    const symbol = request.nextUrl.searchParams.get('symbol');

    if (!symbol) {
      return NextResponse.json(
        { success: false, error: 'Symbol parameter required' },
        { status: 400 }
      );
    }

    const data = await getLiveMarketData(symbol);

    if (!data) {
      return NextResponse.json(
        { success: false, error: `No live data available for ${symbol}` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Live market fetch error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch live data',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/market/live
 * Batch fetch live data for multiple symbols
 */
export async function POST(request: NextRequest) {
  try {
    const { symbols } = await request.json();

    if (!Array.isArray(symbols) || symbols.length === 0) {
      return NextResponse.json(
        { success: false, error: 'symbols array required' },
        { status: 400 }
      );
    }

    // Limit to 50 symbols per request
    const limitedSymbols = symbols.slice(0, 50);
    const data = await batchGetLiveMarketData(limitedSymbols);

    return NextResponse.json({
      success: true,
      data,
      count: Object.keys(data).length,
    });
  } catch (error) {
    console.error('Batch live market fetch error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch live data',
      },
      { status: 500 }
    );
  }
}
