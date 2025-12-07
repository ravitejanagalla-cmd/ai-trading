import axios from 'axios';

export interface NewsItem {
  date: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  category?: string;
  sentiment?: string;
  impact?: string;
}

/**
 * Fetch stock news from Finnhub API (free tier: 60 calls/minute)
 * https://finnhub.io/
 */
export async function fetchStockNewsFromAPI(symbol: string, days: number = 7): Promise<NewsItem[]> {
  try {
    // For Indian stocks, try multiple formats
    const symbols = [
      symbol,           // Original (TCS)
      `${symbol}.NS`,   // NSE format (TCS.NS)
      `NSE:${symbol}`,  // Finnhub NSE format
    ];

    let news: NewsItem[] = [];
    
    for (const trySymbol of symbols) {
      try {
        const apiKey = process.env.FINNHUB_API_KEY!;
        
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const formatDate = (d: Date) => d.toISOString().split('T')[0];

        console.log(`📰 Trying Finnhub with symbol: ${trySymbol}...`);

        const response = await axios.get(`https://finnhub.io/api/v1/company-news`, {
          params: {
            symbol: trySymbol,
            from: formatDate(startDate),
            to: formatDate(endDate),
            token: apiKey
          },
          timeout: 10000
        });

        if (response.data && response.data.length > 0) {
          news = response.data.slice(0, 10).map((item: any) => ({
            date: new Date(item.datetime * 1000).toISOString().split('T')[0],
            title: item.headline,
            summary: item.summary || item.headline,
            source: item.source || 'Finnhub',
            url: item.url || '',
            category: item.category || 'general',
            sentiment: determineSentiment(item.headline + ' ' + (item.summary || ''))
          }));

          console.log(`✅ Fetched ${news.length} news items from Finnhub with ${trySymbol}`);
          return news;
        }
      } catch (err: any) {
        // Handle rate limits and 403s
        if (err.response?.status === 403 || err.response?.status === 429) {
          console.log(`⚠️ Finnhub rate limit/blocked for ${trySymbol}, trying next...`);
          continue;
        }
        // For other errors, continue to next symbol
        continue;
      }
    }

    // If Finnhub fails, try Yahoo Finance RSS
    console.log(`⚠️ No Finnhub news found, trying Yahoo Finance RSS...`);
    return await fetchNewsFromYahooRSS(symbol);
  } catch (error) {
    console.error('News API error:', error);
    return await fetchNewsFromYahooRSS(symbol);
  }
}

/**
 * Fallback: Yahoo Finance RSS feed (works well for Indian stocks)
 */
async function fetchNewsFromYahooRSS(symbol: string): Promise<NewsItem[]> {
  try {
    console.log(`📰 Fetching news for ${symbol} from Yahoo Finance RSS...`);
    
    // Try both NSE and BSE formats
    const formats = [`${symbol}.NS`, `${symbol}.BO`];
    
    for (const ticker of formats) {
      try {
        const response = await axios.get(`https://finance.yahoo.com/rss/headline?s=${ticker}`, {
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
          }
        });

        if (response.data && response.data.includes('<item>')) {
          // Simple XML parsing
          const items = response.data.match(/<item>[\s\S]*?<\/item>/g) || [];
          
          const news: NewsItem[] = items.slice(0, 10).map((item: string) => {
            const title = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] || 
                         item.match(/<title>(.*?)<\/title>/)?.[1] || '';
            const link = item.match(/<link>(.*?)<\/link>/)?.[1] || '';
            const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '';
            const description = item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/)?.[1] ||
                               item.match(/<description>(.*?)<\/description>/)?.[1] || '';

            return {
              date: pubDate ? new Date(pubDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
              title: title.replace(/&amp;/g, '&').replace(/&quot;/g, '"'),
              summary: description.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').substring(0, 200),
              source: 'Yahoo Finance',
              url: link,
              category: categorizeNews(title + ' ' + description),
              sentiment: determineSentiment(title + ' ' + description)
            };
          }).filter((n: NewsItem) => n.title.length > 10);

          if (news.length > 0) {
            console.log(JSON.stringify(news, null, 2));
            console.log(`✅ Fetched ${news.length} news items from Yahoo Finance (${ticker})`);
            return news;
          }
        }
      } catch (err) {
        // Try next format
        continue;
      }
    }

    // Last resort: Generate synthetic news based on company
    console.log(`⚠️ All news sources failed, generating placeholder...`);
    return generatePlaceholderNews(symbol);
  } catch (error) {
    console.error('Yahoo RSS error:', error);
    return generatePlaceholderNews(symbol);
  }
}

/**
 * Generate placeholder news when all sources fail
 */
function generatePlaceholderNews(symbol: string): NewsItem[] {
  const today = new Date().toISOString().split('T')[0];
  
  return [
    {
      date: today,
      title: `${symbol} Trading Update`,
      summary: `Latest market activity and trading session summary for ${symbol}. Monitor for further updates on company developments and market movements.`,
      source: 'Market Data',
      url: '',
      category: 'market',
      sentiment: 'neutral'
    }
  ];
}

/**
 * Simple keyword-based sentiment detection
 */
function determineSentiment(text: string): 'bullish' | 'bearish' | 'neutral' {
  const lower = text.toLowerCase();
  const bullishWords = ['surge', 'rally', 'gain', 'profit', 'growth', 'positive', 'beat', 'strong', 'up', 'rise', 'jump'];
  const bearishWords = ['fall', 'drop', 'loss', 'decline', 'weak', 'negative', 'miss', 'down', 'crash', 'plunge'];
  
  const bullishCount = bullishWords.filter(w => lower.includes(w)).length;
  const bearishCount = bearishWords.filter(w => lower.includes(w)).length;
  
  if (bullishCount > bearishCount) return 'bullish';
  if (bearishCount > bullishCount) return 'bearish';
  return 'neutral';
}

/**
 * Categorize news by keywords
 */
function categorizeNews(text: string): string {
  const lower = text.toLowerCase();
  
  if (lower.includes('earning') || lower.includes('profit') || lower.includes('revenue') || lower.includes('quarter')) return 'earnings';
  if (lower.includes('acqui') || lower.includes('merge') || lower.includes('deal')) return 'acquisition';
  if (lower.includes('regul') || lower.includes('sec') || lower.includes('comply') || lower.includes('fine')) return 'regulatory';
  if (lower.includes('product') || lower.includes('launch') || lower.includes('release')) return 'product';
  if (lower.includes('market') || lower.includes('sector') || lower.includes('industry')) return 'market';
  
  return 'general';
}

/**
 * Analyze sentiment score
 */
export function calculateNewsSentimentScore(news: NewsItem[]): { overall: string; score: number; bullish: number; bearish: number } {
  if (news.length === 0) {
    return { overall: 'neutral', score: 0, bullish: 0, bearish: 0 };
  }

  let bullish = 0;
  let bearish = 0;
  let neutral = 0;

  news.forEach(item => {
    if (item.sentiment === 'bullish') bullish++;
    else if (item.sentiment === 'bearish') bearish++;
    else neutral++;
  });

  const total = news.length;
  const score = (bullish - bearish) / total;
  
  let overall = 'neutral';
  if (score > 0.2) overall = 'bullish';
  else if (score < -0.2) overall = 'bearish';

  return { overall, score, bullish, bearish };
}
