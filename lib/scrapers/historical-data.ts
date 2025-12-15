import axios from 'axios';
import { OHLCVData } from '../types';

/**
 * Fetch historical OHLCV data from multiple sources
 * Falls back through different APIs if one fails
 */
export async function getHistoricalDataFromMultipleSources(
  symbol: string,
  days: number = 90
): Promise<OHLCVData[]> {
  const sources = [
    { name: 'YahooFinance', fn: () => fetchFromYahooFinance(symbol, days) },
    { name: 'AlphaVantage', fn: () => fetchFromAlphaVantage(symbol, days) },
    { name: 'Finnhub', fn: () => fetchFromFinnhub(symbol, days) },
  ];

  for (const source of sources) {
    try {
      console.log(`📊 Trying ${source.name} for historical data of ${symbol}...`);
      const data = await source.fn();
      
      if (data && data.length > 0) {
        console.log(`✅ Got ${data.length} records from ${source.name} for ${symbol}`);
        return data;
      }
    } catch (error: any) {
      console.warn(`⚠️ ${source.name} failed for ${symbol}: ${error.message}`);
      continue;
    }
  }

  console.warn(`⚠️ All historical data sources exhausted for ${symbol}`);
  return [];
}

/**
 * Yahoo Finance Historical Data
 * Works great for Indian stocks with .NS suffix
 */
async function fetchFromYahooFinance(symbol: string, days: number): Promise<OHLCVData[]> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const then = now - days * 24 * 60 * 60;

    // Try multiple symbol formats
    const formats = [`${symbol}.NS`, `${symbol}.BO`, symbol];
    
    for (const ticker of formats) {
      try {
        const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=historical`;
        
        const response = await axios.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          timeout: 10000,
          validateStatus: () => true
        });

        if (response.status === 200 && response.data?.quoteSummary?.result?.[0]) {
          const result = response.data.quoteSummary.result[0];
          // Yahoo has different structure, try to extract
          continue;
        }
      } catch (err) {
        continue;
      }
    }

    // Fallback to v8 API (more reliable for historical data)
    for (const ticker of formats) {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=${days}d`;
        
        const response = await axios.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          timeout: 10000,
          validateStatus: () => true
        });

        if (response.status === 200 && response.data?.chart?.result?.[0]) {
          const result = response.data.chart.result[0];
          const timestamps = result.timestamp || [];
          const quotes = result.indicators?.quote?.[0] || {};

          if (timestamps.length === 0) {
            continue;
          }

          const data: OHLCVData[] = timestamps.map((ts: number, idx: number) => {
            const date = new Date(ts * 1000).toISOString().split('T')[0];
            
            return {
              symbol,
              date,
              open: quotes.open?.[idx] || quotes.close?.[idx] || 0,
              high: quotes.high?.[idx] || quotes.close?.[idx] || 0,
              low: quotes.low?.[idx] || quotes.close?.[idx] || 0,
              close: quotes.close?.[idx] || 0,
              volume: quotes.volume?.[idx] || 0
            };
          }).filter((d: OHLCVData) => d.close > 0);

          if (data.length > 0) {
            return data;
          }
        }
      } catch (err) {
        continue;
      }
    }

    throw new Error('No valid Yahoo Finance data');
  } catch (error: any) {
    throw new Error(`Yahoo Finance failed: ${error.message}`);
  }
}

/**
 * Alpha Vantage Historical Data
 * Free tier: 5 calls/min, 500 calls/day
 * https://www.alphavantage.co/
 */
async function fetchFromAlphaVantage(symbol: string, days: number): Promise<OHLCVData[]> {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  
  if (!apiKey) {
    throw new Error('Alpha Vantage API key not configured');
  }

  try {
    const response = await axios.get('https://www.alphavantage.co/query', {
      params: {
        function: 'TIME_SERIES_DAILY',
        symbol: symbol,
        apikey: apiKey,
        outputsize: 'full'
      },
      timeout: 15000,
      validateStatus: () => true
    });

    const data = response.data;
    
    if (data['Time Series (Daily)']) {
      const timeSeries = data['Time Series (Daily)'];
      const entries = Object.entries(timeSeries)
        .slice(0, days)
        .map(([date, values]: [string, any]) => ({
          symbol,
          date,
          open: parseFloat(values['1. open']) || 0,
          high: parseFloat(values['2. high']) || 0,
          low: parseFloat(values['3. low']) || 0,
          close: parseFloat(values['4. close']) || 0,
          volume: parseInt(values['5. volume']) || 0
        }))
        .filter(d => d.close > 0);

      if (entries.length > 0) {
        return entries;
      }
    }

    throw new Error('No time series data in Alpha Vantage response');
  } catch (error: any) {
    throw new Error(`Alpha Vantage failed: ${error.message}`);
  }
}

/**
 * Finnhub Historical Data
 * Free tier: 60 calls/min
 * https://finnhub.io/
 */
async function fetchFromFinnhub(symbol: string, days: number): Promise<OHLCVData[]> {
  const apiKey = process.env.FINNHUB_API_KEY;
  
  if (!apiKey) {
    throw new Error('Finnhub API key not configured');
  }

  try {
    const endTime = Math.floor(Date.now() / 1000);
    const startTime = endTime - days * 24 * 60 * 60;

    // Finnhub prefers plain symbols or with .NS for NSE
    const formats = [symbol, `${symbol}.NS`];

    for (const ticker of formats) {
      try {
        const response = await axios.get('https://finnhub.io/api/v1/stock/candle', {
          params: {
            symbol: ticker,
            resolution: 'D',
            from: Math.floor(startTime),
            to: Math.floor(endTime),
            token: apiKey
          },
          timeout: 10000,
          validateStatus: () => true
        });

        if (response.status === 200 && response.data?.c) {
          const data: OHLCVData[] = [];
          const { t, o, h, l, c, v } = response.data;

          if (Array.isArray(t) && Array.isArray(c)) {
            for (let i = 0; i < t.length; i++) {
              const date = new Date(t[i] * 1000).toISOString().split('T')[0];
              data.push({
                symbol,
                date,
                open: o?.[i] || c[i] || 0,
                high: h?.[i] || c[i] || 0,
                low: l?.[i] || c[i] || 0,
                close: c[i] || 0,
                volume: v?.[i] || 0
              });
            }

            if (data.length > 0) {
              return data;
            }
          }
        }
      } catch (err) {
        continue;
      }
    }

    throw new Error('No Finnhub data found');
  } catch (error: any) {
    throw new Error(`Finnhub failed: ${error.message}`);
  }
}

/**
 * Alternative: Try fetching from trading view or other sources
 * Can be implemented if needed
 */
async function fetchFromTradingView(symbol: string, days: number): Promise<OHLCVData[]> {
  // Trading View has anti-bot protection, would need Puppeteer with stealth
  // Keeping this as placeholder for future enhancement
  throw new Error('TradingView scraping not implemented (requires Puppeteer)');
}
