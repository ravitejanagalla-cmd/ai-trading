import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

/**
 * Fetch logo from TradingView and save to public/logos/stocks/
 * Called on-demand when logo is not found locally
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    if (!symbol || symbol.length === 0) {
      return NextResponse.json(
        { error: 'symbol required' },
        { status: 400 }
      );
    }

    const logoUrl = await fetchTradingViewLogoUrl(symbol);
    if (!logoUrl) {
      return NextResponse.json(
        { success: false, error: 'Logo not found on TradingView' },
        { status: 404 }
      );
    }

    // Download logo
    const logoResponse = await axios.get(logoUrl, {
      responseType: 'arraybuffer',
      timeout: 8000,
      validateStatus: () => true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (logoResponse.status !== 200 || !logoResponse.data.length) {
      return NextResponse.json(
        { success: false, error: 'Failed to download logo' },
        { status: 404 }
      );
    }

    // Save to public/logos/stocks/
    const logosDir = join(process.cwd(), 'public', 'logos', 'stocks');
    if (!existsSync(logosDir)) {
      mkdirSync(logosDir, { recursive: true });
    }

    const buffer = Buffer.from(logoResponse.data);
    const isSvg = buffer.toString().startsWith('<');
    const filename = `${symbol.toLowerCase()}.${isSvg ? 'svg' : 'png'}`;
    const filepath = join(logosDir, filename);

    writeFileSync(filepath, buffer);
    console.log(`📥 Logo saved for ${symbol}: ${filename} (${buffer.length} bytes)`);

    return NextResponse.json({
      success: true,
      symbol,
      filename,
      size: buffer.length
    });
  } catch (error) {
    console.error('Logo fetch error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch logo' 
      },
      { status: 500 }
    );
  }
}

/**
 * Fetch logo URL from TradingView using Puppeteer
 */
async function fetchTradingViewLogoUrl(symbol: string): Promise<string | null> {
  try {
    const puppeteer = await import('puppeteer');
    let browser;

    try {
      browser = await puppeteer.launch({ headless: 'new' });
      const page = await browser.newPage();
      const url = `https://www.tradingview.com/symbols/NSE-${symbol}/`;

      await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });

      const logoUrl = await page.evaluate(() => {
        const img = document.querySelector('img[class*="logo"]');
        return img ? img.src : null;
      });

      return logoUrl;
    } finally {
      if (browser) await browser.close();
    }
  } catch (err) {
    console.debug(`TradingView fetch failed for ${symbol}:`, err instanceof Error ? err.message : String(err));
    return null;
  }
}
