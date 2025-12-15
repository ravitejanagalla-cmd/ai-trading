import { getHistoricalData, getStockQuote } from '@/lib/scrapers/nse-scraper';
import { getHistoricalDataFromMultipleSources } from '@/lib/scrapers/historical-data';
import { storeStockPrice } from '@/lib/data/db';

export interface ComprehensiveStockData {
  symbol: string;
  current: any;
  historical: any[];
  news: any[];
  error?: string;
}

/**
 * Fetch historical data with multiple fallbacks
 */
async function fetchHistoricalWithFallback(
  symbol: string,
  days: number
): Promise<any[]> {
  try {
    // First try NSE API
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const formatDate = (d: Date): string => d.toISOString().split('T')[0];
    
    const nseData = await getHistoricalData(symbol, formatDate(startDate), formatDate(new Date()));
    
    if (nseData && nseData.length > 0) {
      return nseData;
    }
  } catch (error) {
    console.warn(`⚠️ NSE historical data failed, trying alternate sources...`);
  }

  // If NSE fails, try multiple alternate sources
  try {
    const alternateData = await getHistoricalDataFromMultipleSources(symbol, days);
    return alternateData;
  } catch (error) {
    console.warn(`⚠️ All historical data sources failed for ${symbol}`);
    return [];
  }
}

/**
 * Fetch all available data for a stock symbol
 */
export async function fetchComprehensiveData(
  symbol: string,
  days: number = 90
): Promise<ComprehensiveStockData> {
  try {
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    console.log(`📊 Fetching comprehensive data for ${symbol}...`);

    // Fetch current quote and historical data in parallel
    const [currentQuote, historicalData] = await Promise.all([
      getStockQuote(symbol),
      fetchHistoricalWithFallback(symbol, days)
    ]);

    console.log(`✅ Fetched ${historicalData?.length || 0} days of historical data for ${symbol}`);

    // Fetch news from reliable API
    let news: any[] = [];
    try {
      const { fetchStockNewsFromAPI, calculateNewsSentimentScore } = await import('@/lib/scrapers/news-api');
      news = await fetchStockNewsFromAPI(symbol, 7);
      console.log(`✅ Fetched ${news.length} news items for ${symbol}`);
      
      if (news.length > 0) {
        // Calculate sentiment
        const sentiment = calculateNewsSentimentScore(news);
        console.log(`📊 News sentiment: ${sentiment.overall} (${sentiment.bullish} bullish, ${sentiment.bearish} bearish)`);
      }
      
      // Analyze news with LLM for better categorization
      if (news.length > 0) {
        const { analyzeNewsWithLLM } = await import('@/lib/analysis/news-analyzer');
        console.log(`🔍 Analyzing ${news.length} news items with LLM...`);
        news = await analyzeNewsWithLLM(news);
        console.log(`✅ Analyzed and categorized news`);
        
        // Store analyzed news in database
        const { storeNewsEvents } = await import('@/lib/analysis/pattern-analyzer');
        await storeNewsEvents(symbol, news);
      }
    } catch (error) {
      console.error('News API/analysis failed:', error);
      news = [{
        date: new Date().toISOString().split('T')[0],
        title: `${symbol} Market Update`,
        summary: 'Unable to fetch news at this time',
        source: 'System',
        category: 'general',
        sentiment: 'neutral',
        impact: 'low'
      }];
    }

    // Store historical data in database
    if (historicalData && historicalData.length > 0) {
      for (const day of historicalData.slice(0, 90)) { // Limit to 90 days
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
        } catch (error) {
          // Skip duplicates silently
        }
      }
    }

    return {
      symbol,
      current: currentQuote,
      historical: historicalData || [],
      news // Real scraped news
    };
  } catch (error) {
    console.error(`Error fetching data for ${symbol}:`, error);
    return {
      symbol,
      current: null,
      historical: [],
      news: [],
      error: error instanceof Error ? error.message : 'Failed to fetch data'
    };
  }
}

/**
 * Calculate technical indicators from historical data
 */
export function calculateIndicators(historical: any[]) {
  if (!historical || historical.length < 5) {
    return {
      trend: 'Unknown',
      momentum: 'Neutral',
      volatility: 0
    };
  }

  const prices = historical.map(d => d.close).reverse();
  const current = prices[prices.length - 1];
  const ma5 = prices.slice(-5).reduce((a, b) => a + b, 0) / 5;
  const ma20 = prices.length >= 20 
    ? prices.slice(-20).reduce((a, b) => a + b, 0) / 20 
    : ma5;

  // Simple trend detection
  const trend = current > ma5 && ma5 > ma20 ? 'Bullish' 
    : current < ma5 && ma5 < ma20 ? 'Bearish' 
    : 'Sideways';

  // Momentum (last 5 days change)
  const momentum = ((current - prices[prices.length - 6]) / prices[prices.length - 6] * 100).toFixed(2);

  // Volatility (standard deviation of last 10 days)
  const recent = prices.slice(-10);
  const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const variance = recent.reduce((sum, price) => sum + Math.pow(price - avg, 2), 0) / recent.length;
  const volatility = Math.sqrt(variance);

  return {
    trend,
    momentum: parseFloat(momentum),
    volatility: parseFloat(volatility.toFixed(2)),
    currentPrice: current,
    ma5: parseFloat(ma5.toFixed(2)),
    ma20: parseFloat(ma20.toFixed(2))
  };
}
