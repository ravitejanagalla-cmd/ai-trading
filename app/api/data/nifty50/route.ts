import { NextRequest, NextResponse } from 'next/server';
import { getNifty50Constituents, getStockQuote, batchGetQuotes } from '@/lib/scrapers/nse-scraper';

/**
 * GET /api/data/nifty50 - Get NIFTY 50 constituent list
 */
export async function GET(request: NextRequest) {
  try {
    const constituents = await getNifty50Constituents();

    return NextResponse.json({
      success: true,
      count: constituents.length,
      constituents
    });
  } catch (error) {
    console.error('Error fetching NIFTY 50 constituents:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch NIFTY 50 constituents' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/data/nifty50 - Get quotes for NIFTY 50 stocks
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { symbols } = body;

    if (!symbols || !Array.isArray(symbols)) {
      return NextResponse.json(
        { success: false, error: 'symbols array required' },
        { status: 400 }
      );
    }

    const quotes = await batchGetQuotes(symbols);

    return NextResponse.json({
      success: true,
      quotes
    });
  } catch (error) {
    console.error('Error fetching quotes:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch quotes' },
      { status: 500 }
    );
  }
}
