/**
 * Bulk fetch stock company logos and store locally
 * Run with: npx ts-node scripts/fetch-stock-logos.ts
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';

const STOCK_UNIVERSE = [
  'TCS', 'RELIANCE', 'INFY', 'HDFCBANK', 'ICICIBANK', 'SBIN', 'HDFC', 'BAJAJFINSV',
  'MARUTI', 'WIPRO', 'LT', 'AXISBANK', 'KOTAKBANK', 'BHARTIARTL', 'SUNPHARMA',
  'ASIANPAINT', 'ONGC', 'JSWSTEEL', 'TATASTEEL', 'POWERGRID', 'HEROMOTOCO',
  'ULTRACEMCO', 'ADANIPORTS', 'APOLLOHOSP', 'NESTLEIND', 'DRREDDY', 'LUPIN',
  'TECHM', 'INDIGO', 'ADANIGREEN',
];

const LOGOS_DIR = path.join(process.cwd(), 'public', 'logos', 'stocks');

async function ensureLogosDir() {
  if (!fs.existsSync(LOGOS_DIR)) {
    fs.mkdirSync(LOGOS_DIR, { recursive: true });
    console.log(`✅ Created logos directory: ${LOGOS_DIR}`);
  }
}

/**
 * Fetch logo from Yahoo Finance
 */
async function fetchYahooLogo(symbol: string): Promise<Buffer | null> {
  try {
    // Yahoo Finance logo API
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}.NS?modules=assetProfile`;
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 5000,
      validateStatus: () => true
    });

    if (response.status === 200) {
      const logoUrl = response.data?.quoteSummary?.result?.[0]?.assetProfile?.website;
      if (logoUrl) {
        // Try to fetch logo from company website
        const logoResponse = await axios.get(`${logoUrl}/favicon.ico`, {
          responseType: 'arraybuffer',
          timeout: 3000,
          validateStatus: () => true
        });

        if (logoResponse.status === 200) {
          return Buffer.from(logoResponse.data);
        }
      }
    }
  } catch (err) {
    console.debug(`  Yahoo fetch failed for ${symbol}`);
  }
  return null;
}

/**
 * Fetch logo from Finnhub
 */
async function fetchFinnhubLogo(symbol: string): Promise<Buffer | null> {
  try {
    const apiKey = process.env.FINNHUB_API_KEY;
    if (!apiKey) return null;

    const url = `https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}.NS&token=${apiKey}`;
    
    const response = await axios.get(url, {
      timeout: 5000,
      validateStatus: () => true
    });

    if (response.status === 200 && response.data?.logo) {
      const logoUrl = response.data.logo;
      const logoResponse = await axios.get(logoUrl, {
        responseType: 'arraybuffer',
        timeout: 5000,
        validateStatus: () => true
      });

      if (logoResponse.status === 200) {
        return Buffer.from(logoResponse.data);
      }
    }
  } catch (err) {
    console.debug(`  Finnhub fetch failed for ${symbol}`);
  }
  return null;
}

/**
 * Fetch logo from Screener.in
 */
async function fetchScreenerLogo(symbol: string): Promise<Buffer | null> {
  try {
    const url = `https://www.screener.in/api/company/${symbol}/chart/`;
    
    const response = await axios.get(url, {
      timeout: 5000,
      validateStatus: () => true
    });

    if (response.status === 200) {
      // Screener stores company info, try to extract logo URL
      const logoUrl = response.data?.companyInfo?.logo || response.data?.logo;
      if (logoUrl) {
        const logoResponse = await axios.get(logoUrl, {
          responseType: 'arraybuffer',
          timeout: 5000,
          validateStatus: () => true
        });

        if (logoResponse.status === 200) {
          return Buffer.from(logoResponse.data);
        }
      }
    }
  } catch (err) {
    console.debug(`  Screener fetch failed for ${symbol}`);
  }
  return null;
}

/**
 * Fetch stock logo with fallback chain
 */
async function fetchStockLogo(symbol: string): Promise<Buffer | null> {
  console.log(`⏳ Fetching logo for ${symbol}...`);

  // Try sources in order
  const sources = [
    { name: 'Finnhub', fn: () => fetchFinnhubLogo(symbol) },
    { name: 'Screener', fn: () => fetchScreenerLogo(symbol) },
    { name: 'Yahoo', fn: () => fetchYahooLogo(symbol) },
  ];

  for (const source of sources) {
    try {
      const buffer = await source.fn();
      if (buffer) {
        console.log(`  ✅ Got logo from ${source.name}`);
        return buffer;
      }
    } catch (err) {
      console.debug(`  ${source.name} failed: ${err}`);
    }
  }

  console.log(`  ⚠️ Could not fetch logo`);
  return null;
}

/**
 * Main function
 */
async function main() {
  try {
    await ensureLogosDir();

    let successCount = 0;
    let skipCount = 0;

    for (const symbol of STOCK_UNIVERSE) {
      // Skip if already exists
      const logoPath = path.join(LOGOS_DIR, `${symbol.toLowerCase()}.png`);
      if (fs.existsSync(logoPath)) {
        console.log(`⏭️  ${symbol} - already exists`);
        skipCount++;
        continue;
      }

      const logoBuffer = await fetchStockLogo(symbol);
      
      if (logoBuffer) {
        fs.writeFileSync(logoPath, logoBuffer);
        console.log(`  📁 Saved to ${logoPath}`);
        successCount++;
      }

      // Rate limiting - 500ms delay between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`\n📊 Summary:`);
    console.log(`  ✅ Successfully fetched: ${successCount}`);
    console.log(`  ⏭️  Already cached: ${skipCount}`);
    console.log(`  📂 Logo directory: ${LOGOS_DIR}`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
