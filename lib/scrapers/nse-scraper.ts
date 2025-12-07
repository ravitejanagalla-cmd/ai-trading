import { OHLCVData } from '../types';
import { 
  initBrowser, 
  createStealthPage, 
  withRetry, 
  randomDelay, 
  handleCookieConsent,
  isPageBlocked 
} from './utils';

const NSE_BASE_URL = 'https://www.nseindia.com';

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
 * Fetch quote data for a symbol
 */
export async function getStockQuote(symbol: string): Promise<OHLCVData | null> {
  const browser = await initBrowser();
  
  try {
    const page = await createStealthPage(browser);
    
    return await withRetry(async () => {
      // First, visit main page to get cookies
      await page.goto(NSE_BASE_URL, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      await randomDelay(2000, 3000);
      await handleCookieConsent(page);

      // Now fetch quote API
      const quoteUrl = `${NSE_BASE_URL}/api/quote-equity?symbol=${encodeURIComponent(symbol)}`;
      
      await page.goto(quoteUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Check if blocked
      if (await isPageBlocked(page)) {
        throw new Error('Scraper blocked by NSE');
      }

      const content = await page.content();
      const cheerio = await loadCheerio();
      const $ = cheerio.load(content);
      const text = $('pre').text() || $('body').text();
      
      const data = JSON.parse(text);
      
      if (data && data.priceInfo) {
        const priceInfo = data.priceInfo;
        const today = new Date().toISOString().split('T')[0];
        
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

      return null;
    }, 3);

  } catch (error) {
    console.error(`Error fetching quote for ${symbol}:`, error);
    return null;
  } finally {
    await browser.close();
  }
}

/**
 * Fetch historical data for a symbol
 * Note: NSE provides limited historical data via their API
 */
export async function getHistoricalData(
  symbol: string, 
  fromDate: string, 
  toDate: string
): Promise<OHLCVData[]> {
  const browser = await initBrowser();
  
  try {
    const page = await createStealthPage(browser);
    
    return await withRetry(async () => {
      // Visit main page first
      await page.goto(NSE_BASE_URL, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      await randomDelay(2000, 3000);

      // Convert dates to required format
      const from = fromDate.split('-').reverse().join('-'); // DD-MM-YYYY
      const to = toDate.split('-').reverse().join('-');

      // Fetch historical data API
      const histUrl = `${NSE_BASE_URL}/api/historical/cm/equity?symbol=${encodeURIComponent(symbol)}&series=[%22EQ%22]&from=${from}&to=${to}`;
      
      await page.goto(histUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      const content = await page.content();
      const cheerio = await loadCheerio();
      const $ = cheerio.load(content);
      const text = $('pre').text() || $('body').text();
      
      const data = JSON.parse(text);
      
      if (data && data.data) {
        return data.data.map((item: any) => ({
          symbol,
          date: item.CH_TIMESTAMP || item.mTIMESTAMP,
          open: parseFloat(item.CH_OPENING_PRICE || item.OPEN_PRICE),
          high: parseFloat(item.CH_TRADE_HIGH_PRICE || item.HIGH_PRICE),
          low: parseFloat(item.CH_TRADE_LOW_PRICE || item.LOW_PRICE),
          close: parseFloat(item.CH_CLOSING_PRICE || item.CLOSE_PRICE),
          volume: parseInt(item.CH_TOT_TRADED_QTY || item.TTL_TRD_QNTY)
        }));
      }

      return [];
    }, 3);

  } catch (error) {
    console.error(`Error fetching historical data for ${symbol}:`, error);
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
