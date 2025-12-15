import { OHLCVData } from '../types';
import { 
  initBrowser, 
  createStealthPage, 
  withRetry, 
  randomDelay, 
  handleCookieConsent,
  isPageBlocked 
} from './utils';
import axios from 'axios';

const NSE_BASE_URL = 'https://www.nseindia.com';

// Realistic headers to avoid blocking
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'DNT': '1',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Referer': 'https://www.nseindia.com/',
};

// Helper to dynamically load cheerio
async function loadCheerio() {
  const cheerio = await import('cheerio');
  return cheerio;
}

/**
 * Get NIFTY 50 constituent list
 */
export async function getNifty50Constituents(): Promise<string[]> {
  const browser = await initBrowser();
  
  try {
    const page = await createStealthPage(browser);
    
    return await withRetry(async () => {
      // Navigate to NSE indices page
      await page.goto(`${NSE_BASE_URL}/api/equity-stockIndices?index=NIFTY%2050`, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      await randomDelay(1000, 2000);

      // Get JSON response
      const content = await page.content();
      const cheerio = await loadCheerio();
      const $ = cheerio.load(content);
      const text = $('pre').text() || $('body').text();
      
      const data = JSON.parse(text);
      
      if (data && data.data) {
        const symbols = data.data.map((item: any) => item.symbol);
        console.log(`✓ Found ${symbols.length} NIFTY 50 constituents`);
        return symbols;
      }

      throw new Error('Failed to parse NIFTY 50 data');
    }, 3);

  } finally {
    await browser.close();
  }
}

/**
 * Fetch quote data for a symbol using direct HTTP (no Puppeteer)
 */
export async function getStockQuote(symbol: string): Promise<OHLCVData | null> {
  return await withRetry(async () => {
    try {
      const quoteUrl = `${NSE_BASE_URL}/api/quote-equity?symbol=${encodeURIComponent(symbol)}`;
      
      console.log(`📈 Fetching quote for ${symbol} from NSE...`);
      
      const response = await axios.get(quoteUrl, {
        headers: HEADERS,
        timeout: 15000,
        validateStatus: () => true // Don't throw on non-2xx status
      });

      // Check if response is HTML error
      if (typeof response.data === 'string' && (response.data.includes('<!DOCTYPE') || response.data.includes('<html'))) {
        console.warn(`⚠️ NSE returned HTML error for quote ${symbol}`);
        return null;
      }

      // Check if response is JSON
      if (typeof response.data !== 'object' || !response.data) {
        console.warn(`⚠️ Invalid response from NSE for ${symbol}`);
        return null;
      }

      const data = response.data;
      
      if (data && data.priceInfo) {
        const priceInfo = data.priceInfo;
        const today = new Date().toISOString().split('T')[0];
        
        console.log(`✅ Got quote for ${symbol}: ₹${priceInfo.lastPrice}`);
        
        return {
          symbol,
          date: today,
          open: priceInfo.open || priceInfo.lastPrice,
          high: priceInfo.intraDayHighLow?.max || priceInfo.lastPrice,
          low: priceInfo.intraDayHighLow?.min || priceInfo.lastPrice,
          close: priceInfo.lastPrice,
          volume: data.preOpenMarket?.totalTradedVolume || 0
        };
      }

      console.warn(`⚠️ No priceInfo in NSE response for ${symbol}`);
      return null;
    } catch (error: any) {
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        throw new Error('NSE request timeout');
      }
      if (error.response?.status === 403 || error.response?.status === 429) {
        throw new Error('NSE rate limit/blocked');
      }
      throw error;
    }
  }, 3);
}

/**
 * Fetch historical data for a symbol using direct HTTP (no Puppeteer)
 */
export async function getHistoricalData(
  symbol: string, 
  fromDate: string, 
  toDate: string
): Promise<OHLCVData[]> {
  return await withRetry(async () => {
    try {
      // Convert dates to required format
      const from = fromDate.split('-').reverse().join('-'); // DD-MM-YYYY
      const to = toDate.split('-').reverse().join('-');

      // Fetch historical data API with cache-busting
      const cacheBreaker = Date.now(); // Add timestamp to force fresh data
      const histUrl = `${NSE_BASE_URL}/api/historical/cm/equity?symbol=${encodeURIComponent(symbol)}&series=[%22EQ%22]&from=${from}&to=${to}&_t=${cacheBreaker}`;
      
      console.log(`📊 Fetching historical data for ${symbol}...`);
      
      const response = await axios.get(histUrl, {
        headers: {
          ...HEADERS,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        timeout: 15000,
        validateStatus: () => true // Don't throw on non-2xx status
      });

      // Check if response is HTML error
      if (typeof response.data === 'string' && (response.data.includes('<!DOCTYPE') || response.data.includes('<html'))) {
        console.warn(`⚠️ NSE returned HTML error for ${symbol}, trying fallback sources...`);
      } else if (typeof response.data === 'object' && response.data?.data && Array.isArray(response.data.data) && response.data.data.length > 0) {
        // NSE success
        const data = response.data;
        console.log(`✅ Got ${data.data.length} historical records from NSE for ${symbol}`);
        
        return data.data.map((item: any) => ({
          symbol,
          date: item.CH_TIMESTAMP || item.mTIMESTAMP,
          open: parseFloat(item.CH_OPENING_PRICE || item.OPEN_PRICE),
          high: parseFloat(item.CH_TRADE_HIGH_PRICE || item.HIGH_PRICE),
          low: parseFloat(item.CH_TRADE_LOW_PRICE || item.LOW_PRICE),
          close: parseFloat(item.CH_CLOSING_PRICE || item.CLOSE_PRICE),
          volume: parseInt(item.CH_TOT_TRADED_QTY || item.TTL_TRD_QNTY)
        }));
      } else {
        console.warn(`⚠️ Invalid response from NSE for ${symbol}, trying fallback sources...`);
      }

      // Fallback 1: Screener.in (most reliable for recent data, but limited to ~1 year)
      console.log(`🔄 Attempting Screener.in for ${symbol}...`);
      let screenerData = await getHistoricalDataFromScreener(symbol, fromDate, toDate);
      if (screenerData.length > 0) {
        console.log(`✅ Got ${screenerData.length} records from Screener.in for ${symbol}`);
        return screenerData;
      }

      // Fallback 2: Moneycontrol
      console.log(`🔄 Attempting Moneycontrol for ${symbol}...`);
      let mcData = await getHistoricalDataFromMoneycontrol(symbol, fromDate, toDate);
      if (mcData.length > 0) {
        console.log(`✅ Got ${mcData.length} records from Moneycontrol for ${symbol}`);
        return mcData;
      }

      // Fallback 3: NSE via Puppeteer (if others fail)
      console.log(`🔄 Attempting NSE via Puppeteer for ${symbol}...`);
      let puppeteerData = await getHistoricalDataFromNSEPuppeteer(symbol, fromDate, toDate);
      if (puppeteerData.length > 0) {
        console.log(`✅ Got ${puppeteerData.length} records from NSE Puppeteer for ${symbol}`);
        return puppeteerData;
      }

      // Note: For extended historical data (>1 year), chart displays are limited
      // to ~248 trading days due to Screener.in and browser rendering constraints
      // This is sufficient for technical analysis but not full historical backtesting

      console.warn(`⚠️ No historical data available for ${symbol} from any source`);
      return [];
    } catch (error: any) {
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        throw new Error('NSE request timeout');
      }
      if (error.response?.status === 403 || error.response?.status === 429) {
        throw new Error('NSE rate limit/blocked');
      }
      throw error;
    }
  }, 3);
}

/**
 * Fetch historical data from NSE using Puppeteer (with stealth mode)
 */
async function getHistoricalDataFromNSEPuppeteer(
  symbol: string,
  fromDate: string,
  toDate: string
): Promise<OHLCVData[]> {
  const browser = await initBrowser();
  
  try {
    const page = await createStealthPage(browser);
    
    return await withRetry(async () => {
      // Navigate to NSE chart/historical data page
      const from = fromDate.split('-').reverse().join('-'); // DD-MM-YYYY
      const to = toDate.split('-').reverse().join('-');
      
      // Try different API formats
      const urls = [
        `${NSE_BASE_URL}/api/historical/cm/equity?symbol=${symbol}&series=EQ&from=${from}&to=${to}`,
        `${NSE_BASE_URL}/api/historical/cm/equity?symbol=${symbol}&from=${from}&to=${to}`,
        `${NSE_BASE_URL}/api/chart-data?symbol=${symbol}&resolution=1D&from=${fromDate}&to=${toDate}`
      ];
      
      let histUrl = urls[0];
      console.log(`  [Stealth] Fetching ${histUrl}`);
      
      const response = await page.goto(histUrl, {
        waitUntil: 'networkidle0',
        timeout: 25000
      });

      if (!response) {
        console.warn(`  [Stealth] No response from NSE for ${symbol}`);
        return [];
      }

      console.log(`  [Stealth] Response status: ${response.status()}`);

      await randomDelay(500, 1000);

      // Use page.evaluate to extract JSON directly from page
      const jsonData = await page.evaluate(() => {
        try {
          // Try to parse page body as JSON
          const text = document.body.innerText;
          return JSON.parse(text);
        } catch {
          return null;
        }
      });

      if (!jsonData) {
        // Fallback to parsing via cheerio
        const content = await page.content();
        const cheerio = await loadCheerio();
        const $ = cheerio.load(content);
        
        let jsonText = $('pre').text() || $('body').text() || '';
        jsonText = jsonText.replace(/<!DOCTYPE[^>]*>/gi, '').replace(/<[^>]*>/g, '').trim();
        
        if (!jsonText || jsonText.length === 0) {
          console.warn(`  [Stealth] No content for ${symbol}`);
          return [];
        }
        
        try {
          const parsed = JSON.parse(jsonText);
          return extractHistoricalData(parsed, symbol);
        } catch (parseErr) {
          console.warn(`  [Stealth] Failed to parse JSON: ${parseErr}`);
          return [];
        }
      }

      return extractHistoricalData(jsonData, symbol);
    }, 2);
    
  } catch (error) {
    console.warn(`[Stealth] NSE fetch failed for ${symbol}:`, error);
    return [];
  } finally {
    await browser.close();
  }
}

/**
 * Helper to extract historical data from NSE response
 */
function extractHistoricalData(data: any, symbol: string): OHLCVData[] {
  if (!data || !data.data || !Array.isArray(data.data) || data.data.length === 0) {
    return [];
  }

  console.log(`  [Stealth] Got ${data.data.length} records for ${symbol}`);
  
  return data.data.map((item: any) => ({
    symbol,
    date: item.CH_TIMESTAMP || item.mTIMESTAMP,
    open: parseFloat(item.CH_OPENING_PRICE || item.OPEN_PRICE),
    high: parseFloat(item.CH_TRADE_HIGH_PRICE || item.HIGH_PRICE),
    low: parseFloat(item.CH_TRADE_LOW_PRICE || item.LOW_PRICE),
    close: parseFloat(item.CH_CLOSING_PRICE || item.CLOSE_PRICE),
    volume: parseInt(item.CH_TOT_TRADED_QTY || item.TTL_TRD_QNTY)
  })).filter((d: any) => d.close > 0);
}

/**
 * Fetch historical data from Screener.in using API interception
 */
async function getHistoricalDataFromScreener(
  symbol: string,
  fromDate: string,
  toDate: string
): Promise<OHLCVData[]> {
  const browser = await initBrowser();
  
  try {
    const page = await createStealthPage(browser);
    
    return await withRetry(async () => {
      // Calculate days from date range
      const from = new Date(fromDate);
      const to = new Date(toDate);
      const daysRequested = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
      
      // Use max 10000 days (Screener API supports this)
      const daysParam = Math.min(daysRequested + 10, 10000);
      
      const screenerUrl = `https://www.screener.in/company/${symbol}/`;
      
      console.log(`  [Screener] Fetching ${screenerUrl} (requesting ${daysParam} days of data)`);
      
      // Listen for API responses
      let historicalResponse: any = null;
      
      page.on('response', async (response) => {
        try {
          const url = response.url();
          // Look for chart data API calls - intercept the actual API with days parameter
          if (url.includes('/api/') && url.includes('chart') && response.status() === 200) {
            const data = await response.json();
            historicalResponse = data;
            console.log(`  [Screener] Intercepted API response from ${url}`);
          }
        } catch (err) {
          // Ignore JSON parse errors for non-JSON responses
        }
      });

      // Directly request Screener API with extended days parameter and cache-busting
      try {
        const cacheBreaker = Date.now(); // Add timestamp to bypass cache
        const directApiUrl = `https://www.screener.in/api/company/${symbol}/chart/?q=Price-DMA50-DMA200-Volume&days=${daysParam}&_t=${cacheBreaker}`;
        console.log(`  [Screener] Direct API request: ${directApiUrl}`);
        
        const apiResponse = await axios.get(directApiUrl, {
          headers: {
            ...HEADERS,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          },
          timeout: 15000,
          validateStatus: () => true
        });
        
        if (apiResponse.status === 200 && apiResponse.data) {
          historicalResponse = apiResponse.data;
          console.log(`  [Screener] Got API response with ${daysParam} days requested`);
        }
      } catch (err) {
        console.log(`  [Screener] Direct API request failed, will use page navigation: ${err}`);
      }

      // If direct API didn't work, try page navigation
      if (!historicalResponse) {
        console.log(`  [Screener] Opening page for ${symbol}...`);
        
        // Intercept network requests to capture API calls with requested days
        await page.on('response', async (response) => {
          try {
            const url = response.url();
            if (url.includes('/api/') && url.includes('chart') && url.includes(`days=${daysParam}`)) {
              const data = await response.json();
              historicalResponse = data;
              console.log(`  [Screener] Got ${daysParam}-day API response from page navigation`);
            }
          } catch (err) {
            // Ignore errors
          }
        });
        
        await page.goto(screenerUrl, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });

        // Wait for chart data to load
        await randomDelay(2000, 3000);
        
        // Try to find and click time period buttons (1Y, 3Y, 5Y, All)
        // Screener uses clickable period buttons in the chart area
        const periodSelectors = [
          'button[data-period="all"]',
          'button[data-period="max"]',
          'button:contains("All")',
          'button:contains("Max")',
          'span[data-period="all"]',
          '.chart-period-all',
          'button.period-all'
        ];
        
        for (const selector of periodSelectors) {
          try {
            const element = await page.$(selector);
            if (element) {
              console.log(`  [Screener] Found period button with selector: ${selector}`);
              await element.click();
              await randomDelay(1500, 2500);
              break;
            }
          } catch (err) {
            // Try next selector
          }
        }
        
        // Try to extract from window object
        const windowData = await page.evaluate(() => {
          return (window as any).__INITIAL_STATE__ || (window as any).__data__ || null;
        });
        
        if (windowData && !historicalResponse) {
          historicalResponse = windowData;
        }
      }

      if (!historicalResponse) {
        console.log(`  [Screener] No API data found for ${symbol}`);
        return [];
      }

      // Parse the API response - pass days param to handle filtering
      const data = parseScreenerChartData(historicalResponse, symbol, daysRequested);
      
      if (data.length > 0) {
        console.log(`  [Screener] Got ${data.length} records for ${symbol}`);
        return data;
      }
      
      return [];
    }, 1);
    
  } catch (error) {
    console.warn(`[Screener] Fetch failed for ${symbol}:`, error);
    return [];
  } finally {
    await browser.close();
  }
}

/**
 * Parse Screener chart API response format
 */
function parseScreenerChartData(data: any, symbol: string, maxDays: number = 10000): OHLCVData[] {
  try {
    // Screener returns data in format: { datasets: [{ metric, label, values: [[date, value], ...] }] }
    
    if (!data) return [];
    
    let closeData: any[] = [];
    let volumeData: any[] = [];

    // Try format 1: datasets array (current Screener API)
    if (Array.isArray(data.datasets)) {
      for (const dataset of data.datasets) {
        if ((dataset.metric === 'Price' || dataset.metric === 'CLOSE') && Array.isArray(dataset.values)) {
          closeData = dataset.values;
        } else if ((dataset.metric === 'Volume' || dataset.metric === 'VOLUME') && Array.isArray(dataset.values)) {
          volumeData = dataset.values;
        }
      }
    }

    // Try format 2: metrics array (legacy)
    if (Array.isArray(data.metrics) && closeData.length === 0) {
      for (const metric of data.metrics) {
        if (metric.metric === 'CLOSE' && Array.isArray(metric.values)) {
          closeData = metric.values;
        } else if (metric.metric === 'VOLUME' && Array.isArray(metric.values)) {
          volumeData = metric.values;
        }
      }
    }

    // Try format 3: chartsData object
    if (data.chartsData && closeData.length === 0) {
      closeData = data.chartsData.close || [];
      volumeData = data.chartsData.volume || [];
    }

    // Try format 4: direct values
    if (data.close && closeData.length === 0) {
      closeData = Array.isArray(data.close) ? data.close : [];
      volumeData = Array.isArray(data.volume) ? data.volume : [];
    }

    if (closeData.length === 0) {
      console.warn(`  [Screener] No close data found in response`);
      return [];
    }

    // Create a map for quick lookup (volume might be [date, volume] or [date, volume, extra])
    const volumeMap = new Map(volumeData.map((item: any) => [item[0], item[1]]));

    // Combine all data points
    const allData = closeData
      .map(([date, close]: any) => {
        const dateStr = String(date);
        const closeVal = parseFloat(String(close));

        if (!dateStr || closeVal <= 0) return null;

        // Get volume, handling both [date, volume] and [date, volume, {metadata}] formats
        let volume = 0;
        const volumeEntry = volumeMap.get(date);
        if (volumeEntry !== undefined) {
          volume = parseInt(String(volumeEntry)) || 0;
        }

        return {
          symbol,
          date: dateStr,
          open: closeVal, // Use close as open since we don't have OHLC data
          high: closeVal,
          low: closeVal,
          close: closeVal,
          volume: volume,
        };
      })
      .filter((d): d is OHLCVData => d !== null);
    
    // Limit to requested days (default 10000 for full history)
    return allData.slice(0, maxDays);
  } catch (error) {
    console.error(`Error parsing Screener chart data:`, error);
    return [];
  }
}

/**
 * Fetch historical data from Moneycontrol using Puppeteer
 */
async function getHistoricalDataFromMoneycontrol(
  symbol: string,
  fromDate: string,
  toDate: string
): Promise<OHLCVData[]> {
  const browser = await initBrowser();
  
  try {
    const page = await createStealthPage(browser);
    
    return await withRetry(async () => {
      // Moneycontrol stock page
      const mcUrl = `https://www.moneycontrol.com/india/stockprice/${symbol}`;
      
      console.log(`  [Moneycontrol] Fetching ${mcUrl}`);
      
      await page.goto(mcUrl, {
        waitUntil: 'networkidle2',
        timeout: 20000
      });

      await randomDelay(1500, 2500);

      // Extract price history
      const data = await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('table tr'));
        
        return rows.map((row: any) => {
          const cells = row.querySelectorAll('td');
          if (cells.length < 5) return null;
          
          return {
            date: cells[0]?.textContent?.trim(),
            open: parseFloat(cells[1]?.textContent?.trim().replace(/₹|,/g, '') || '0'),
            high: parseFloat(cells[2]?.textContent?.trim().replace(/₹|,/g, '') || '0'),
            low: parseFloat(cells[3]?.textContent?.trim().replace(/₹|,/g, '') || '0'),
            close: parseFloat(cells[4]?.textContent?.trim().replace(/₹|,/g, '') || '0'),
            volume: parseInt(cells[5]?.textContent?.trim().replace(/,/g, '') || '0'),
          };
        }).filter(d => d && d.open > 0);
      });
      
      if (data && data.length > 0) {
        console.log(`  [Moneycontrol] Got ${data.length} records for ${symbol}`);
        return data.map((d: any) => ({
          symbol,
          date: d.date,
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close,
          volume: d.volume
        }));
      }
      
      return [];
    }, 1);
    
  } catch (error) {
    console.warn(`[Moneycontrol] Fetch failed for ${symbol}:`, error);
    return [];
  } finally {
    await browser.close();
  }
}

/**
 * Batch fetch quotes for multiple symbols
 */
export async function batchGetQuotes(symbols: string[]): Promise<Record<string, OHLCVData | null>> {
  const results: Record<string, OHLCVData | null> = {};
  
  // Process in batches to avoid overwhelming the server
  const batchSize = 5;
  
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (symbol) => {
      const quote = await getStockQuote(symbol);
      results[symbol] = quote;
      await randomDelay(500, 1500); // Rate limiting
    });

    await Promise.all(batchPromises);
    
    console.log(`Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(symbols.length / batchSize)}`);
  }

  return results;
}
