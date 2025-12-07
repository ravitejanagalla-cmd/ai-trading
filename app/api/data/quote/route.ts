import { NextRequest, NextResponse } from 'next/server';
import { getStockQuote } from '@/lib/scrapers/nse-scraper';

/**
 * GET /api/data/quote?symbol=TCS
 * Get real-time quote for a symbol
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get('symbol');

    if (!symbol) {
      return NextResponse.json(
        { success: false, error: 'symbol parameter required' },
        { status: 400 }
      );
    }

    const quote = await getStockQuote(symbol);

    if (!quote) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch quote' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      quote
    });
  } catch (error) {
    console.error('Error fetching quote:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
