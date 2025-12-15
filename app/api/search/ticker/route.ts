import { NextRequest, NextResponse } from 'next/server';
import { searchTicker } from '@/lib/analysis/ticker-search';

/**
 * GET /api/search/ticker?q=tcs
 * Search for stock symbols dynamically from NSE
 * Also triggers background logo fetching for results
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

    // Trigger background logo fetches for search results (non-blocking)
    if (results && Array.isArray(results)) {
      results.slice(0, 5).forEach((result: any) => {
        // Fire and forget - don't await
        fetchLogoInBackground(result.symbol).catch(err => {
          console.debug(`Background logo fetch failed for ${result.symbol}:`, err.message);
        });
      });
    }

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

/**
 * Fetch logo from TradingView in the background
 */
async function fetchLogoInBackground(symbol: string): Promise<void> {
  try {
    const puppeteer = await import('puppeteer');
    let browser;

    try {
      browser = await puppeteer.launch({ headless: 'new' });
      const page = await browser.newPage();
      const url = `https://www.tradingview.com/symbols/NSE-${symbol}/`;

      await page.goto(url, { waitUntil: 'networkidle2', timeout: 12000 });

      const logoUrl = await page.evaluate(() => {
        const img = document.querySelector('img[class*="logo"]');
        return img ? img.src : null;
      });

      if (logoUrl) {
        // Download and save
        const axios = await import('axios');
        const logoResponse = await axios.default.get(logoUrl, {
          responseType: 'arraybuffer',
          timeout: 8000,
          validateStatus: () => true,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        if (logoResponse.status === 200 && logoResponse.data.length > 0) {
          const { writeFileSync, existsSync, mkdirSync } = await import('fs');
          const { join } = await import('path');
          
          const logosDir = join(process.cwd(), 'public', 'logos', 'stocks');
          if (!existsSync(logosDir)) {
            mkdirSync(logosDir, { recursive: true });
          }

          const buffer = Buffer.from(logoResponse.data);
          const isSvg = buffer.toString().startsWith('<');
          const filename = `${symbol.toLowerCase()}.${isSvg ? 'svg' : 'png'}`;
          const filepath = join(logosDir, filename);

          writeFileSync(filepath, buffer);
          console.log(`✅ Logo cached for ${symbol}`);
        }
      }
    } finally {
      if (browser) await browser.close();
    }
  } catch (err) {
    // Silently fail in background
    console.debug(`Logo fetch failed for ${symbol}`);
  }
}
