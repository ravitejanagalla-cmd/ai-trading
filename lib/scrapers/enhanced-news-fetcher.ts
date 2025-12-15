import axios from 'axios';
import { NewsArticle } from '@/lib/data/enriched-data';

/**
 * Fetch news from multiple sources with intelligent fallback
 */
export async function fetchEnhancedNews(symbol: string, days: number = 7): Promise<NewsArticle[]> {
  const allNews: NewsArticle[] = [];
  const seenIds = new Set<string>();

  // Try multiple sources in parallel
  const [
    finnhubNews,
    newsApiNews,
    alphaVantageNews,
    contentNews,
    yahooNews,
    moneycontrolNews,
    bseNews
  ] = await Promise.allSettled([
    fetchFinnhubNews(symbol, days),
    fetchNewsApiNews(symbol, days),
    fetchAlphaVantageNews(symbol, days),
    fetchContentNews(symbol, days),
    fetchYahooFinanceNews(symbol, days),
    fetchMoneycontrolNews(symbol, days),
    fetchBSENews(symbol, days)
  ]);

  // Collect news from successful sources
  const sources = [
    { name: 'Finnhub', result: finnhubNews },
    { name: 'NewsAPI', result: newsApiNews },
    { name: 'Alpha Vantage', result: alphaVantageNews },
    { name: 'ContentWeb', result: contentNews },
    { name: 'Yahoo Finance', result: yahooNews },
    { name: 'Moneycontrol', result: moneycontrolNews },
    { name: 'BSE', result: bseNews }
  ];

  for (const source of sources) {
    if (source.result.status === 'fulfilled' && source.result.value) {
      for (const article of source.result.value) {
        if (!seenIds.has(article.id)) {
          seenIds.add(article.id);
          allNews.push(article);
        }
      }
    }
  }

  // If no news found from any source, return empty array
  if (allNews.length === 0) {
    console.log(`⚠️ No news articles found for ${symbol} from any source`);
    return [];
  }

  // Remove duplicates and sort by impact + recency
  return allNews
    .filter((article, index, self) =>
      index === self.findIndex(a => a.id === article.id)
    )
    .sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      const impactDiff = b.impact - a.impact;
      if (impactDiff !== 0) return impactDiff;
      return dateB - dateA;
    })
    .slice(0, 50); // Limit to top 50
}

/**
 * Fetch from Finnhub API
 */
async function fetchFinnhubNews(symbol: string, days: number): Promise<NewsArticle[]> {
  try {
    const apiKey = process.env.FINNHUB_API_KEY;
    if (!apiKey) return [];

    const response = await axios.get('https://finnhub.io/api/v1/company-news', {
      params: {
        symbol: symbol,
        from: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        to: new Date().toISOString().split('T')[0],
        token: apiKey
      },
      timeout: 5000
    });

    if (!Array.isArray(response.data)) return [];

    return response.data.map(item => ({
      id: `finnhub-${item.id}`,
      title: item.headline || '',
      summary: item.summary || '',
      source: item.source || 'Finnhub',
      url: item.url || '',
      date: new Date(item.datetime * 1000).toISOString().split('T')[0],
      sentiment: classifySentiment(item.headline + ' ' + item.summary),
      category: classifyCategory(item.headline, item.summary),
      impact: calculateImpact(item.headline, item.summary),
      isBreakingNews: isBreakingNews(item.headline, item.summary)
    }));
  } catch (error) {
    console.warn(`⚠️ Finnhub news fetch failed for ${symbol}:`, error instanceof Error ? error.message : '');
    return [];
  }
}

/**
 * Fetch from NewsAPI
 */
async function fetchNewsApiNews(symbol: string, days: number): Promise<NewsArticle[]> {
  try {
    const apiKey = process.env.NEWS_API_KEY;
    if (!apiKey) return [];

    const response = await axios.get('https://newsapi.org/v2/everything', {
      params: {
        q: `"${symbol}" OR ${symbol}`,
        sortBy: 'relevancy',
        language: 'en',
        from: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        apiKey: apiKey
      },
      timeout: 5000
    });

    if (!response.data.articles) return [];

    return response.data.articles.map((item: any) => ({
      id: `newsapi-${item.url}`,
      title: item.title || '',
      summary: item.description || '',
      source: item.source?.name || 'NewsAPI',
      url: item.url || '',
      date: new Date(item.publishedAt).toISOString().split('T')[0],
      sentiment: classifySentiment(item.title + ' ' + (item.description || '')),
      category: classifyCategory(item.title, item.description || ''),
      impact: calculateImpact(item.title, item.description || ''),
      isBreakingNews: isBreakingNews(item.title, item.description || '')
    }));
  } catch (error) {
    console.warn(`⚠️ NewsAPI fetch failed for ${symbol}:`, error instanceof Error ? error.message : '');
    return [];
  }
}

/**
 * Fetch from Alpha Vantage
 */
async function fetchAlphaVantageNews(symbol: string, days: number): Promise<NewsArticle[]> {
  try {
    const apiKey = process.env.ALPHA_VANTAGE_KEY;
    if (!apiKey) return [];

    const response = await axios.get('https://www.alphavantage.co/query', {
      params: {
        function: 'NEWS_SENTIMENT',
        tickers: symbol,
        apikey: apiKey,
        limit: 50
      },
      timeout: 5000
    });

    if (!response.data.feed) return [];

    const cutoffDate = Date.now() - days * 24 * 60 * 60 * 1000;

    return response.data.feed
      .filter((item: any) => new Date(item.time_published).getTime() > cutoffDate)
      .map((item: any) => ({
        id: `alphavantage-${item.url}`,
        title: item.title || '',
        summary: item.summary || '',
        source: item.source || 'Alpha Vantage',
        url: item.url || '',
        date: new Date(item.time_published).toISOString().split('T')[0],
        sentiment: parseSentimentScore(item.overall_sentiment_score),
        category: item.category_within_source || 'general',
        impact: parseFloat(item.overall_sentiment_score || '0') * 10,
        isBreakingNews: false
      }));
  } catch (error) {
    console.warn(`⚠️ Alpha Vantage news fetch failed for ${symbol}:`, error instanceof Error ? error.message : '');
    return [];
  }
}

/**
 * Fetch from content aggregation
 */
async function fetchContentNews(symbol: string, days: number): Promise<NewsArticle[]> {
  try {
    // Try Moneycontrol or other Indian news sources
    const response = await axios.get(
      `https://www.moneycontrol.com/stocksmarketsindia/${symbol.toLowerCase()}/news`,
      {
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );

    // Parse HTML for news items - simplified
    const titlePattern = /<h[2-3][^>]*>([^<]+)<\/h[2-3]>/g;
    const matches = Array.from(response.data.matchAll(titlePattern));

    return matches.slice(0, 20).map((match: any, index: number) => ({
      id: `content-${symbol}-${index}`,
      title: match[1] || `${symbol} Update ${index}`,
      summary: `Latest update for ${symbol}`,
      source: 'Moneycontrol',
      url: `https://www.moneycontrol.com`,
      date: new Date().toISOString().split('T')[0],
      sentiment: 'neutral',
      category: 'general',
      impact: 5,
      isBreakingNews: false
    }));
  } catch (error) {
    console.warn(`⚠️ Content news fetch failed for ${symbol}:`, error instanceof Error ? error.message : '');
    return [];
  }
}

/**
 * Classify sentiment from text
 */
function classifySentiment(text: string): 'bullish' | 'bearish' | 'neutral' {
  const bullishWords = [
    'surge', 'jump', 'gain', 'rally', 'soar', 'bull', 'win', 'profit', 'growth', 'beat',
    'approval', 'upgrade', 'outperform', 'strong', 'positive', 'optimism'
  ];
  const bearishWords = [
    'crash', 'fall', 'drop', 'decline', 'plunge', 'bear', 'loss', 'miss', 'downgrade', 'weak',
    'negative', 'bearish', 'concern', 'risk', 'danger', 'warning'
  ];

  const lowerText = text.toLowerCase();
  let bullScore = bullishWords.filter(word => lowerText.includes(word)).length;
  let bearScore = bearishWords.filter(word => lowerText.includes(word)).length;

  if (bullScore > bearScore) return 'bullish';
  if (bearScore > bullScore) return 'bearish';
  return 'neutral';
}

/**
 * Classify news category
 */
function classifyCategory(title: string, summary: string): string {
  const text = (title + ' ' + summary).toLowerCase();

  const categories: { [key: string]: string[] } = {
    earnings: ['earnings', 'q1', 'q2', 'q3', 'q4', 'revenue', 'profit', 'eps'],
    acquisition: ['acquisition', 'merger', 'acquisition', 'deal', 'buyout', 'acquisition'],
    regulatory: ['regulatory', 'regulation', 'approval', 'license', 'fda', 'sec'],
    product: ['product', 'launch', 'new', 'release', 'innovation'],
    management: ['ceo', 'cfo', 'director', 'resigned', 'appointed', 'management'],
    dividend: ['dividend', 'buyback', 'shareholder', 'distribution']
  };

  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some(keyword => text.includes(keyword))) {
      return category;
    }
  }

  return 'general';
}

/**
 * Calculate impact score (1-10)
 */
function calculateImpact(title: string, summary: string): number {
  const text = (title + ' ' + summary).toLowerCase();

  const highImpactWords = [
    'bankruptcy', 'scandal', 'fraud', 'investigation', 'lawsuit',
    'acquisition', 'merger', 'ipo', 'ceo resignation', 'accounting'
  ];
  const mediumImpactWords = [
    'earnings', 'dividend', 'earnings beat', 'earnings miss', 'guidance',
    'product launch', 'partnership'
  ];

  if (highImpactWords.some(word => text.includes(word))) return 10;
  if (mediumImpactWords.some(word => text.includes(word))) return 7;
  return 5;
}

/**
 * Detect breaking news
 */
function isBreakingNews(title: string, summary: string): boolean {
  const text = (title + ' ' + summary).toLowerCase();
  const breakingIndicators = ['breaking', 'just in', 'latest', 'alert', 'urgent', 'developing'];

  return breakingIndicators.some(indicator => text.includes(indicator));
}

/**
 * Parse sentiment score from Alpha Vantage
 */
function parseSentimentScore(score: string | number): 'bullish' | 'bearish' | 'neutral' {
  const numScore = typeof score === 'string' ? parseFloat(score) : score;

  if (numScore > 0.1) return 'bullish';
  if (numScore < -0.1) return 'bearish';
  return 'neutral';
}

/**
 * Fetch from Yahoo Finance news
 */
async function fetchYahooFinanceNews(symbol: string, days: number): Promise<NewsArticle[]> {
  try {
    console.log(`🔍 Trying Yahoo Finance news for ${symbol}...`);
    const response = await axios.get(`https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}.NS`, {
      params: {
        modules: 'news'
      },
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const news = response.data?.quoteSummary?.result?.[0]?.news;
    if (!Array.isArray(news) || news.length === 0) {
      console.log(`⚠️ No news from Yahoo Finance for ${symbol}`);
      return [];
    }
    console.log(`✅ Found ${news.length} articles from Yahoo Finance`);

    const cutoffDate = Date.now() - days * 24 * 60 * 60 * 1000;

    return news
      .filter((item: any) => item.providerPublishTime * 1000 > cutoffDate)
      .slice(0, 15)
      .map((item: any) => ({
        id: `yahoo-${item.uuid || item.link}`,
        title: item.title || '',
        summary: item.summary || '',
        source: item.publisher || 'Yahoo Finance',
        url: item.link || '',
        date: new Date(item.providerPublishTime * 1000).toISOString().split('T')[0],
        sentiment: classifySentiment(item.title + ' ' + (item.summary || '')),
        category: classifyCategory(item.title, item.summary || ''),
        impact: calculateImpact(item.title, item.summary || ''),
        isBreakingNews: isBreakingNews(item.title, item.summary || '')
      }));
  } catch (error) {
    console.warn(`⚠️ Yahoo Finance news fetch failed for ${symbol}:`, error instanceof Error ? error.message : '');
    return [];
  }
}

/**
 * Fetch from Moneycontrol India - API approach
 */
async function fetchMoneycontrolNews(symbol: string, days: number): Promise<NewsArticle[]> {
  try {
    console.log(`🔍 Trying Moneycontrol news for ${symbol}...`);
    // Try to fetch from Moneycontrol's news API
    const response = await axios.get(`https://www.moneycontrol.com/mccode/common/ajax/newswidget.php`, {
      params: {
        q: symbol,
        limit: 20
      },
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.moneycontrol.com'
      }
    });

    if (!response.data) {
      console.log(`⚠️ No data from Moneycontrol for ${symbol}`);
      return [];
    }
    console.log(`✅ Got response from Moneycontrol, parsing...`);

    const cutoffDate = Date.now() - days * 24 * 60 * 60 * 1000;

    // Parse JSON if response is string
    const newsData = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
    
    if (!Array.isArray(newsData)) return [];

    return newsData
      .filter((item: any) => {
        const itemDate = new Date(item.published || item.date || new Date()).getTime();
        return itemDate > cutoffDate;
      })
      .slice(0, 15)
      .map((item: any) => ({
        id: `moneycontrol-${item.url || item.id}`,
        title: item.title || item.headline || '',
        summary: item.summary || item.content || `${symbol} market news`,
        source: 'Moneycontrol',
        url: item.url || item.link || '',
        date: new Date(item.published || item.date || new Date()).toISOString().split('T')[0],
        sentiment: classifySentiment(item.title + ' ' + (item.summary || item.content || '')),
        category: classifyCategory(item.title || '', item.summary || item.content || ''),
        impact: calculateImpact(item.title || '', item.summary || item.content || ''),
        isBreakingNews: isBreakingNews(item.title || '', item.summary || item.content || '')
      }));
  } catch (error) {
    console.warn(`⚠️ Moneycontrol news fetch failed for ${symbol}:`, error instanceof Error ? error.message : '');
    return [];
  }
}

/**
 * Fetch from BSE India official announcements
 */
async function fetchBSENews(symbol: string, days: number): Promise<NewsArticle[]> {
  try {
    console.log(`🔍 Trying BSE news for ${symbol}...`);
    // Fetch from BSE announcements
    const response = await axios.get(`https://www.bseindia.com/api/GetAnnouncementData.aspx`, {
      params: {
        sSymbol: symbol,
        sLimitCount: 50
      },
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.data || !Array.isArray(response.data)) {
      console.log(`⚠️ Invalid data from BSE for ${symbol}`);
      return [];
    }
    console.log(`✅ Got ${response.data.length} items from BSE`);

    const cutoffDate = Date.now() - days * 24 * 60 * 60 * 1000;

    return response.data
      .filter((item: any) => {
        try {
          const itemDate = new Date(item.DT_DATE || new Date()).getTime();
          return itemDate > cutoffDate;
        } catch {
          return false;
        }
      })
      .slice(0, 15)
      .map((item: any) => ({
        id: `bse-${item.sRefId || item.DT_DATE}`,
        title: item.sHeadline || item.sSubject || `${symbol} Announcement`,
        summary: item.sSubject || `BSE announcement for ${symbol}`,
        source: 'BSE India',
        url: `https://www.bseindia.com/news/announcement.aspx?refid=${item.sRefId}`,
        date: new Date(item.DT_DATE || new Date()).toISOString().split('T')[0],
        sentiment: 'neutral',
        category: 'announcement',
        impact: 6,
        isBreakingNews: false
      }));
  } catch (error) {
    console.warn(`⚠️ BSE news fetch failed for ${symbol}:`, error instanceof Error ? error.message : '');
    return [];
  }
}


