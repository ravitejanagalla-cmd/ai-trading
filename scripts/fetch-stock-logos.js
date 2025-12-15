/**
 * Bulk fetch stock company logos and store locally
 * Run with: node scripts/fetch-stock-logos.js
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

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
 * Fetch logo from TradingView (most reliable for Indian stocks)
 * Uses actual img src extraction from the DOM
 */
async function fetchTradingViewLogo(symbol) {
  let browser;
  try {
    const puppeteer = await import('puppeteer');
    browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    
    const url = `https://www.tradingview.com/symbols/NSE-${symbol}/`;
    
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
    
    // Extract actual img src from the page
    const logoUrl = await page.evaluate(() => {
      const img = document.querySelector('img[class*="logo"]');
      return img ? img.src : null;
    });
    
    if (logoUrl) {
      console.debug(`  TradingView: Found logo URL: ${logoUrl}`);
      
      const logoResponse = await axios.get(logoUrl, {
        responseType: 'arraybuffer',
        timeout: 8000,
        validateStatus: () => true,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (logoResponse.status === 200 && logoResponse.data.length > 0) {
        return Buffer.from(logoResponse.data);
      }
    }
  } catch (err) {
    console.debug(`  TradingView fetch failed for ${symbol}: ${err.message}`);
  } finally {
    if (browser) await browser.close();
  }
  return null;
}

/**
 * Fetch logo from Finnhub
 */
async function fetchFinnhubLogo(symbol) {
  try {
    const apiKey = process.env.FINNHUB_API_KEY;
    if (!apiKey) {
      console.debug(`  Finnhub: No API key configured`);
      return null;
    }

    const url = `https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}.NS&token=${apiKey}`;
    
    const response = await axios.get(url, {
      timeout: 8000,
      validateStatus: () => true
    });

    if (response.status === 200 && response.data?.logo) {
      const logoUrl = response.data.logo;
      console.debug(`  Finnhub: Found logo URL: ${logoUrl}`);
      
      const logoResponse = await axios.get(logoUrl, {
        responseType: 'arraybuffer',
        timeout: 8000,
        validateStatus: () => true,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (logoResponse.status === 200) {
        return Buffer.from(logoResponse.data);
      }
    }
  } catch (err) {
    console.debug(`  Finnhub fetch failed for ${symbol}: ${err.message}`);
  }
  return null;
}

/**
 * Fetch logo from Moneycontrol
 */
async function fetchMoneycontrolLogo(symbol) {
  try {
    const url = `https://www.moneycontrol.com/stock/${symbol}/`;
    
    const response = await axios.get(url, {
      timeout: 10000,
      validateStatus: () => true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (response.status === 200) {
      const html = response.data;
      
      // Look for logo image
      const logoMatch = html.match(/src=["']([^"']*logo[^"']*)["']/i);
      if (logoMatch && logoMatch[1]) {
        let logoUrl = logoMatch[1];
        if (!logoUrl.startsWith('http')) {
          logoUrl = 'https://www.moneycontrol.com' + logoUrl;
        }
        
        console.debug(`  Moneycontrol: Found logo URL: ${logoUrl}`);
        
        const logoResponse = await axios.get(logoUrl, {
          responseType: 'arraybuffer',
          timeout: 8000,
          validateStatus: () => true
        });

        if (logoResponse.status === 200 && logoResponse.data.length > 0) {
          return Buffer.from(logoResponse.data);
        }
      }
    }
  } catch (err) {
    console.debug(`  Moneycontrol fetch failed for ${symbol}: ${err.message}`);
  }
  return null;
}

/**
 * Create a placeholder logo SVG
 */
function createPlaceholderLogo(symbol) {
  const colors = [
    'FF6B6B', // Red
    '4ECDC4', // Teal
    '45B7D1', // Blue
    'FFA07A', // Light Salmon
    '98D8C8', // Mint
    'F7DC6F', // Yellow
    'BB8FCE', // Purple
    '85C1E2', // Light Blue
  ];
  
  // Deterministic color based on symbol
  const colorIndex = symbol.charCodeAt(0) % colors.length;
  const bgColor = colors[colorIndex];
  const initials = symbol.substring(0, 2).toUpperCase();
  
  // Create a simple SVG placeholder
  const svg = `<svg width="128" height="128" xmlns="http://www.w3.org/2000/svg">
    <rect width="128" height="128" fill="#${bgColor}" rx="8"/>
    <text x="64" y="74" font-size="48" font-weight="bold" text-anchor="middle" fill="white" font-family="Arial">
      ${initials}
    </text>
  </svg>`;
  
  return Buffer.from(svg, 'utf-8');
}

/**
 * Fetch stock logo with fallback chain
 */
async function fetchStockLogo(symbol) {
  console.log(`⏳ Fetching logo for ${symbol}...`);

  // Try multiple sources (TradingView first - most reliable for Indian stocks)
  const sources = [
    { name: 'TradingView', fn: () => fetchTradingViewLogo(symbol) },
    { name: 'Moneycontrol', fn: () => fetchMoneycontrolLogo(symbol) },
    { name: 'Finnhub', fn: () => fetchFinnhubLogo(symbol) },
  ];

  for (const source of sources) {
    try {
      const buffer = await source.fn();
      if (buffer) {
        console.log(`  ✅ Got real logo from ${source.name}`);
        return buffer;
      }
    } catch (err) {
      console.debug(`  ${source.name} failed: ${err.message}`);
    }
  }

  // Fallback: Create placeholder SVG with company initials
  console.log(`  📋 Creating placeholder logo`);
  return createPlaceholderLogo(symbol);
}

/**
 * Main function
 */
async function main() {
  try {
    await ensureLogosDir();

    let successCount = 0;
    let skipCount = 0;
    let placeholderCount = 0;

    for (const symbol of STOCK_UNIVERSE) {
      // Skip if already exists
      const logoPath = path.join(LOGOS_DIR, `${symbol.toLowerCase()}.png`);
      const svgPath = path.join(LOGOS_DIR, `${symbol.toLowerCase()}.svg`);
      
      if (fs.existsSync(logoPath) || fs.existsSync(svgPath)) {
        console.log(`⏭️  ${symbol} - already exists`);
        skipCount++;
        continue;
      }

      const logoBuffer = await fetchStockLogo(symbol);
      
      if (logoBuffer) {
        // Determine if it's SVG or PNG
        const isSvg = logoBuffer.toString().startsWith('<');
        const filePath = isSvg ? svgPath : logoPath;
        
        fs.writeFileSync(filePath, logoBuffer);
        console.log(`  📁 Saved to ${path.basename(filePath)}`);
        
        if (isSvg) {
          placeholderCount++;
        } else {
          successCount++;
        }
      }

      // Rate limiting - 300ms delay between requests
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    console.log(`\n📊 Summary:`);
    console.log(`  ✅ Real logos fetched: ${successCount}`);
    console.log(`  📋 Placeholders created: ${placeholderCount}`);
    console.log(`  ⏭️  Already cached: ${skipCount}`);
    console.log(`  📂 Logo directory: ${LOGOS_DIR}`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
