import { NextRequest, NextResponse } from 'next/server';
import { getHistoricalPrices } from '@/lib/data/db';
import { getHistoricalData } from '@/lib/scrapers/nse-scraper';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const days = parseInt(searchParams.get('days') || '30');

    if (!symbol) {
      return NextResponse.json(
        { success: false, error: 'symbol required' },
        { status: 400 }
      );
    }

    // Fetch fresh data from sources for latest data
    console.log(`📊 Fetching historical data for ${symbol} (${days} days)...`);
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    let data: any[] = [];

    try {
      // Try to fetch from Screener/NSE first (more reliable)
      const freshData = await getHistoricalData(
        symbol,
        formatDate(startDate),
        formatDate(endDate)
      );
      
      if (freshData && freshData.length > 0) {
        data = freshData;
        console.log(`✅ Got ${freshData.length} records for ${symbol}`);
      }
    } catch (err) {
      console.warn(`⚠️ Fresh fetch failed for ${symbol}:`, err);
      
      // Only use database as fallback if requesting older data (not recent)
      // For recent requests (< 180 days), don't use stale database data
      if (days > 180) {
        data = await getHistoricalPrices(symbol, days).catch(() => []);
        if (data && data.length > 0) {
          console.log(`📦 Using ${data.length} cached records from database (fallback)`);
        }
      } else {
        console.log(`⚠️ Skipping database fallback for recent data request (${days} days)`);
      }
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: `No historical data found for ${symbol}`, 
          data: [] 
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      symbol,
      days,
      count: data.length,
      data: data.map((item: any) => ({
        date: String(item.date),
        open: parseFloat(String(item.open || 0)),
        high: parseFloat(String(item.high || 0)),
        low: parseFloat(String(item.low || 0)),
        close: parseFloat(String(item.close || 0)),
        volume: parseInt(String(item.volume || 0))
      }))
    });
  } catch (error) {
    console.error('Historical data error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch data' },
      { status: 500 }
    );
  }
}
