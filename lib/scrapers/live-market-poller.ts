import axios from 'axios';
import { OHLCVData } from '../types';

export interface LiveMarketData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  volume: number;
  bid: number;
  ask: number;
  timestamp: string;
  source: string;
  dayHigh: number;
  dayLow: number;
  open: number;
  previousClose: number;
}

export interface MarketOverview {
  nifty50: { value: number; change: number; changePercent: number };
  sensex: { value: number; change: number; changePercent: number };
  niftyBank: { value: number; change: number; changePercent: number };
  niftyIT: { value: number; change: number; changePercent: number };
  timestamp: string;
}

/**
 * Fetch live market data from NSE India official API
 */
async function fetchFromNSELive(symbol: string): Promise<LiveMarketData | null> {
  try {
    const response = await axios.get(
      `https://www.nseindia.com/api/quote-equity?symbol=${encodeURIComponent(symbol)}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://www.nseindia.com/',
        },
        timeout: 10000,
        validateStatus: () => true,
      }
    );

    if (response.status !== 200 || typeof response.data !== 'object') {
      return null;
    }

    const data = response.data;
    if (!data.priceInfo) return null;

    const price = data.priceInfo.lastPrice;
    const previousClose = data.priceInfo.previousClose || price;
    const change = price - previousClose;
    const changePercent = (change / previousClose) * 100;

    return {
      symbol,
      price,
      change,
      changePercent: parseFloat(changePercent.toFixed(2)),
      high: data.priceInfo.intraDayHighLow?.max || price,
      low: data.priceInfo.intraDayHighLow?.min || price,
      volume: data.preOpenMarket?.totalTradedVolume || 0,
      bid: data.priceInfo.bid || price,
      ask: data.priceInfo.ask || price,
      dayHigh: data.priceInfo.intraDayHighLow?.max || price,
      dayLow: data.priceInfo.intraDayHighLow?.min || price,
      open: data.priceInfo.open || price,
      previousClose,
      timestamp: new Date().toISOString(),
      source: 'NSE',
    };
  } catch (error) {
    console.warn(`NSE live fetch failed for ${symbol}:`, error);
    return null;
  }
}

/**
 * Fetch live market data from Yahoo Finance
 */
async function fetchFromYahooLive(symbol: string): Promise<LiveMarketData | null> {
  try {
    const formats = [`${symbol}.NS`, `${symbol}.BO`, symbol];

    for (const ticker of formats) {
      try {
        const response = await axios.get(
          `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=price`,
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
            timeout: 10000,
            validateStatus: () => true,
          }
        );

        if (response.status === 200 && response.data?.quoteSummary?.result?.[0]?.price) {
          const priceData = response.data.quoteSummary.result[0].price;
          const price = priceData.regularMarketPrice?.raw || 0;
          const previousClose = priceData.regularMarketPreviousClose?.raw || price;
          const change = price - previousClose;
          const changePercent = (change / previousClose) * 100;

          return {
            symbol,
            price,
            change,
            changePercent: parseFloat(changePercent.toFixed(2)),
            high: priceData.regularMarketDayHigh?.raw || price,
            low: priceData.regularMarketDayLow?.raw || price,
            volume: priceData.regularMarketVolume?.raw || 0,
            bid: priceData.bid?.raw || price,
            ask: priceData.ask?.raw || price,
            dayHigh: priceData.regularMarketDayHigh?.raw || price,
            dayLow: priceData.regularMarketDayLow?.raw || price,
            open: priceData.regularMarketOpen?.raw || price,
            previousClose,
            timestamp: new Date().toISOString(),
            source: 'Yahoo Finance',
          };
        }
      } catch {
        continue;
      }
    }

    return null;
  } catch (error) {
    console.warn(`Yahoo live fetch failed for ${symbol}:`, error);
    return null;
  }
}

/**
 * Fetch live market data from Finnhub
 */
async function fetchFromFinnhubLive(symbol: string): Promise<LiveMarketData | null> {
  try {
    const apiKey = process.env.FINNHUB_API_KEY;
    if (!apiKey) return null;

    const formats = [symbol, `${symbol}.NS`];

    for (const ticker of formats) {
      try {
        const response = await axios.get('https://finnhub.io/api/v1/quote', {
          params: {
            symbol: ticker,
            token: apiKey,
          },
          timeout: 10000,
          validateStatus: () => true,
        });

        if (response.status === 200 && response.data?.c) {
          const d = response.data;
          const price = d.c;
          const previousClose = d.pc || price;
          const change = price - previousClose;
          const changePercent = (change / previousClose) * 100;

          return {
            symbol,
            price,
            change,
            changePercent: parseFloat(changePercent.toFixed(2)),
            high: d.h || price,
            low: d.l || price,
            volume: d.v || 0,
            bid: d.bp || price,
            ask: d.ap || price,
            dayHigh: d.h || price,
            dayLow: d.l || price,
            open: d.o || price,
            previousClose,
            timestamp: new Date().toISOString(),
            source: 'Finnhub',
          };
        }
      } catch {
        continue;
      }
    }

    return null;
  } catch (error) {
    console.warn(`Finnhub live fetch failed for ${symbol}:`, error);
    return null;
  }
}

/**
 * Get live market data with fallback sources
 */
export async function getLiveMarketData(symbol: string): Promise<LiveMarketData | null> {
  // Try NSE first (most reliable for Indian stocks)
  let data = await fetchFromNSELive(symbol);
  if (data) return data;

  // Fallback to Yahoo Finance
  data = await fetchFromYahooLive(symbol);
  if (data) return data;

  // Fallback to Finnhub
  data = await fetchFromFinnhubLive(symbol);
  if (data) return data;

  console.warn(`No live data available for ${symbol}`);
  return null;
}

/**
 * Get market overview (indices)
 */
export async function getMarketOverview(): Promise<MarketOverview | null> {
  try {
    const indices = ['NIFTY 50', 'SENSEX', 'NIFTY BANK', 'NIFTY IT'];
    const results = await Promise.all(
      indices.map((index) =>
        axios.get(
          `https://www.nseindia.com/api/equity-stockIndices?index=${encodeURIComponent(index)}`,
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Referer': 'https://www.nseindia.com/',
            },
            timeout: 10000,
            validateStatus: () => true,
          }
        )
      )
    );

    const overview: MarketOverview = {
      nifty50: { value: 0, change: 0, changePercent: 0 },
      sensex: { value: 0, change: 0, changePercent: 0 },
      niftyBank: { value: 0, change: 0, changePercent: 0 },
      niftyIT: { value: 0, change: 0, changePercent: 0 },
      timestamp: new Date().toISOString(),
    };

    // Parse NIFTY 50
    if (results[0].status === 200 && results[0].data?.data?.[0]) {
      const data = results[0].data.data[0];
      overview.nifty50 = {
        value: parseFloat(data.lastPrice),
        change: parseFloat(data.change),
        changePercent: parseFloat(data.pChange),
      };
    }

    // Parse SENSEX (from BSE, use alternative if needed)
    if (results[1].status === 200 && results[1].data?.data?.[0]) {
      const data = results[1].data.data[0];
      overview.sensex = {
        value: parseFloat(data.lastPrice),
        change: parseFloat(data.change),
        changePercent: parseFloat(data.pChange),
      };
    }

    // Parse NIFTY BANK
    if (results[2].status === 200 && results[2].data?.data?.[0]) {
      const data = results[2].data.data[0];
      overview.niftyBank = {
        value: parseFloat(data.lastPrice),
        change: parseFloat(data.change),
        changePercent: parseFloat(data.pChange),
      };
    }

    // Parse NIFTY IT
    if (results[3].status === 200 && results[3].data?.data?.[0]) {
      const data = results[3].data.data[0];
      overview.niftyIT = {
        value: parseFloat(data.lastPrice),
        change: parseFloat(data.change),
        changePercent: parseFloat(data.pChange),
      };
    }

    return overview;
  } catch (error) {
    console.warn('Market overview fetch failed:', error);
    return null;
  }
}

/**
 * Batch fetch live data for multiple symbols
 */
export async function batchGetLiveMarketData(
  symbols: string[]
): Promise<Record<string, LiveMarketData | null>> {
  const results: Record<string, LiveMarketData | null> = {};

  // Process in parallel with rate limiting
  const batchSize = 5;
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);
    const batchPromises = batch.map(async (symbol) => {
      const data = await getLiveMarketData(symbol);
      results[symbol] = data;
    });

    await Promise.all(batchPromises);
    // Rate limiting delay between batches
    if (i + batchSize < symbols.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return results;
}
