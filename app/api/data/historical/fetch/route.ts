import { NextRequest, NextResponse } from 'next/server';
import { storeStockPrice } from '@/lib/data/db';
import { getHistoricalData } from '@/lib/scrapers/nse-scraper';

/**
 * POST /api/data/historical/fetch
 * Fetch and store historical data for a symbol
 */
export async function POST(request: NextRequest) {
  try {
    const { symbol, days = 30 } = await request.json();

    if (!symbol) {
      return NextResponse.json(
        { success: false, error: 'symbol required' },
        { status: 400 }
      );
    }

    console.log(`Fetching ${days} days of historical data for ${symbol}...`);

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    // Fetch historical data from NSE
    const historicalData = await getHistoricalData(
      symbol,
      formatDate(startDate),
      formatDate(endDate)
    );

    if (!historicalData || historicalData.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No historical data found' },
        { status: 404 }
      );
    }

    // Store each day's data
    let stored = 0;
    for (const day of historicalData) {
      try {
        await storeStockPrice({
          symbol,
          date: day.date,
          open: day.open,
          high: day.high,
          low: day.low,
          close: day.close,
          volume: day.volume
        });
        stored++;
      } catch (error) {
        console.error(`Error storing ${symbol} on ${day.date}:`, error);
      }
    }

    console.log(`✅ Stored ${stored}/${historicalData.length} records for ${symbol}`);

    return NextResponse.json({
      success: true,
      symbol,
      daysRequested: days,
      recordsFetched: historicalData.length,
      recordsStored: stored
    });
  } catch (error) {
    console.error('Historical fetch error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Fetch failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/data/historical/fetch
 * Fetch historical data for all NIFTY 50 stocks
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');
    const limit = parseInt(searchParams.get('limit') || '10');

    // Hardcoded NIFTY 50 symbols (first 10 for demo)
    const symbols = [
      'TCS', 'RELIANCE', 'HDFCBANK', 'INFY', 'ICICIBANK',
      'HINDUNILVR', 'ITC', 'SBIN', 'BHARTIARTL', 'BAJFINANCE'
    ].slice(0, limit);

    const results = [];
    let totalStored = 0;

    for (const symbol of symbols) {
      try {
        console.log(`Processing ${symbol}...`);
        
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const formatDate = (d: Date) => d.toISOString().split('T')[0];

        const historicalData = await getHistoricalData(
          symbol,
          formatDate(startDate),
          formatDate(endDate)
        );

        if (historicalData && historicalData.length > 0) {
          let stored = 0;
          for (const day of historicalData) {
            try {
              await storeStockPrice({
                symbol,
                date: day.date,
                open: day.open,
                high: day.high,
                low: day.low,
                close: day.close,
                volume: day.volume
              });
              stored++;
            } catch (error) {
              // Skip duplicates
            }
          }
          
          results.push({
            symbol,
            fetched: historicalData.length,
            stored
          });
          
          totalStored += stored;
          console.log(`✅ ${symbol}: ${stored} records`);
        }

        // Small delay to avoid overwhelming NSE
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`Error processing ${symbol}:`, error);
        results.push({
          symbol,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return NextResponse.json({
      success: true,
      days,
      symbolsProcessed: symbols.length,
      totalRecordsStored: totalStored,
      results
    });
  } catch (error) {
    console.error('Bulk historical fetch error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Fetch failed' },
      { status: 500 }
    );
  }
}
