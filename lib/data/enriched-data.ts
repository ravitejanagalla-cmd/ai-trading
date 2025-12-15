import { pool } from './db';
import axios from 'axios';
import { FundamentalData } from '@/lib/types';

export interface EnrichedStockData {
  symbol: string;
  basics: {
    name: string;
    sector: string;
    industry: string;
  };
  live: {
    price: number;
    change: number;
    changePercent: number;
    volume: number;
    timestamp: string;
  };
  fundamentals: Partial<FundamentalData>;
  news: NewsArticle[];
  technicalIndicators: TechnicalIndicators;
  marketContext: MarketContext;
}

export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  date: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  category: string;
  impact: number; // 1-10
  isBreakingNews: boolean;
}

export interface TechnicalIndicators {
  trend: string;
  momentum: number;
  volatility: number;
  rsi: number;
  macd: { value: number; signal: number; histogram: number };
  movingAverages: {
    ma5: number;
    ma20: number;
    ma50: number;
  };
}

export interface MarketContext {
  nifty50Change: number;
  marketSentiment: string;
  sectorPerformance: string;
  volumeTrend: string;
  priceTarget: number;
  consensusRating: string;
}

/**
 * Initialize enriched data tables
 */
export async function initializeEnrichedDataSchema() {
  const client = await pool.connect();

  try {
    // Drop existing table if it exists to fix any schema issues
    await client.query(`DROP TABLE IF EXISTS stock_fundamentals CASCADE;`);
    
    await client.query(`
      CREATE TABLE stock_fundamentals (
        id SERIAL PRIMARY KEY,
        symbol VARCHAR(20) NOT NULL UNIQUE,
        company_name VARCHAR(255),
        sector VARCHAR(100),
        industry VARCHAR(100),
        market_cap DECIMAL(20,2),
        pe_ratio DECIMAL(10,2),
        pb_ratio DECIMAL(10,2),
        roe DECIMAL(10,2),
        debt_to_equity DECIMAL(10,2),
        revenue DECIMAL(20,2),
        net_income DECIMAL(20,2),
        free_cash_flow DECIMAL(20,2),
        dividend_yield DECIMAL(10,2),
        beta DECIMAL(10,2),
        _52_week_high DECIMAL(10,2),
        _52_week_low DECIMAL(10,2),
        data JSONB,
        last_updated TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX idx_fund_symbol ON stock_fundamentals(symbol);
      CREATE INDEX idx_fund_updated ON stock_fundamentals(last_updated DESC);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS enriched_news (
        id SERIAL PRIMARY KEY,
        symbol VARCHAR(20) NOT NULL,
        article_id VARCHAR(255) UNIQUE,
        title TEXT NOT NULL,
        summary TEXT,
        source VARCHAR(100),
        url VARCHAR(500),
        published_date DATE,
        fetched_date TIMESTAMP DEFAULT NOW(),
        sentiment VARCHAR(20),
        category VARCHAR(50),
        impact_score INT,
        is_breaking_news BOOLEAN DEFAULT FALSE,
        embedding FLOAT8[],
        analyzed_data JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_enews_symbol ON enriched_news(symbol, published_date DESC);
      CREATE INDEX IF NOT EXISTS idx_enews_sentiment ON enriched_news(sentiment);
      CREATE INDEX IF NOT EXISTS idx_enews_breaking ON enriched_news(is_breaking_news) WHERE is_breaking_news = TRUE;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS technical_analysis (
        id SERIAL PRIMARY KEY,
        symbol VARCHAR(20) NOT NULL,
        analysis_date DATE NOT NULL,
        trend VARCHAR(50),
        momentum DECIMAL(10,2),
        volatility DECIMAL(10,2),
        rsi DECIMAL(10,2),
        macd_value DECIMAL(10,2),
        macd_signal DECIMAL(10,2),
        ma_5 DECIMAL(10,2),
        ma_20 DECIMAL(10,2),
        ma_50 DECIMAL(10,2),
        support_level DECIMAL(10,2),
        resistance_level DECIMAL(10,2),
        pattern_detected VARCHAR(100),
        analysis_data JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(symbol, analysis_date)
      );
      CREATE INDEX IF NOT EXISTS idx_tech_symbol ON technical_analysis(symbol, analysis_date DESC);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS market_context_cache (
        id SERIAL PRIMARY KEY,
        context_date DATE NOT NULL,
        nifty_50_change DECIMAL(10,2),
        market_sentiment VARCHAR(50),
        sector_performance JSONB,
        volume_trend VARCHAR(50),
        vix_level DECIMAL(10,2),
        context_data JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(context_date)
      );
      CREATE INDEX IF NOT EXISTS idx_market_date ON market_context_cache(context_date DESC);
    `);

    console.log('✅ Enriched data schema initialized');
  } finally {
    client.release();
  }
}

/**
 * Store or update fundamental data
 */
export async function storeFundamentalData(symbol: string, data: Partial<FundamentalData>) {
  const client = await pool.connect();

  try {
    // Convert all numeric values to proper format
    const convertNum = (val: any) => val == null ? null : Number(val);
    
    await client.query(
      `INSERT INTO stock_fundamentals 
       (symbol, company_name, sector, industry, market_cap, pe_ratio, pb_ratio, roe, debt_to_equity, 
        dividend_yield, beta, _52_week_high, _52_week_low, data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       ON CONFLICT (symbol) DO UPDATE SET
         company_name = EXCLUDED.company_name,
         sector = EXCLUDED.sector,
         industry = EXCLUDED.industry,
         market_cap = EXCLUDED.market_cap,
         pe_ratio = EXCLUDED.pe_ratio,
         pb_ratio = EXCLUDED.pb_ratio,
         roe = EXCLUDED.roe,
         debt_to_equity = EXCLUDED.debt_to_equity,
         dividend_yield = EXCLUDED.dividend_yield,
         beta = EXCLUDED.beta,
         _52_week_high = EXCLUDED._52_week_high,
         _52_week_low = EXCLUDED._52_week_low,
         data = EXCLUDED.data,
         last_updated = NOW()`,
      [
        symbol,
        data.companyName || null,
        data.sector || null,
        data.industry || null,
        convertNum(data.marketCap),
        convertNum(data.peRatio),
        convertNum(data.pbRatio),
        convertNum(data.roe),
        convertNum(data.debtToEquity),
        convertNum(data.dividendYield),
        convertNum(data.beta),
        convertNum(data.weekHigh50),
        convertNum(data.weekLow50),
        JSON.stringify(data)
      ]
    );
  } finally {
    client.release();
  }
}

/**
 * Get cached fundamental data
 */
export async function getFundamentalData(symbol: string) {
  const client = await pool.connect();

  try {
    const result = await client.query(
      `SELECT data FROM stock_fundamentals 
       WHERE symbol = $1 
       AND last_updated > NOW() - INTERVAL '7 days'`,
      [symbol]
    );

    if (result.rows.length > 0) {
      return result.rows[0].data;
    }
    return null;
  } finally {
    client.release();
  }
}

/**
 * Store news articles with enrichment
 */
export async function storeEnrichedNews(symbol: string, articles: NewsArticle[]) {
  const client = await pool.connect();

  try {
    for (const article of articles) {
      await client.query(
        `INSERT INTO enriched_news 
         (symbol, article_id, title, summary, source, url, published_date, sentiment, category, impact_score, is_breaking_news, analyzed_data)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (article_id) DO UPDATE SET
           sentiment = EXCLUDED.sentiment,
           category = EXCLUDED.category,
           impact_score = EXCLUDED.impact_score,
           is_breaking_news = EXCLUDED.is_breaking_news,
           analyzed_data = EXCLUDED.analyzed_data`,
        [
          symbol,
          article.id,
          article.title,
          article.summary,
          article.source,
          article.url,
          article.date,
          article.sentiment,
          article.category,
          article.impact,
          article.isBreakingNews,
          JSON.stringify({
            sentiment: article.sentiment,
            category: article.category,
            impact: article.impact
          })
        ]
      );
    }
  } finally {
    client.release();
  }
}

/**
 * Get recent news for symbol
 */
export async function getRecentNews(symbol: string, days: number = 7, limit: number = 20): Promise<NewsArticle[]> {
  const client = await pool.connect();

  try {
    const result = await client.query(
      `SELECT * FROM enriched_news 
       WHERE symbol = $1 
       AND published_date >= CURRENT_DATE - INTERVAL '${days} days'
       ORDER BY published_date DESC, impact_score DESC
       LIMIT $2`,
      [symbol, limit]
    );

    return result.rows.map(row => ({
      id: row.article_id,
      title: row.title,
      summary: row.summary,
      source: row.source,
      url: row.url,
      date: row.published_date,
      sentiment: row.sentiment,
      category: row.category,
      impact: row.impact_score,
      isBreakingNews: row.is_breaking_news
    }));
  } finally {
    client.release();
  }
}

/**
 * Get breaking news for all symbols
 */
export async function getBreakingNews(limit: number = 10): Promise<NewsArticle[]> {
  const client = await pool.connect();

  try {
    const result = await client.query(
      `SELECT * FROM enriched_news 
       WHERE is_breaking_news = TRUE
       AND published_date >= CURRENT_DATE - INTERVAL '1 day'
       ORDER BY published_date DESC
       LIMIT $1`,
      [limit]
    );

    return result.rows.map(row => ({
      id: row.article_id,
      title: row.title,
      summary: row.summary,
      source: row.source,
      url: row.url,
      date: row.published_date,
      sentiment: row.sentiment,
      category: row.category,
      impact: row.impact_score,
      isBreakingNews: row.is_breaking_news
    }));
  } finally {
    client.release();
  }
}

/**
 * Store technical analysis
 */
export async function storeTechnicalAnalysis(
  symbol: string,
  date: string,
  indicators: TechnicalIndicators
) {
  const client = await pool.connect();

  try {
    await client.query(
      `INSERT INTO technical_analysis 
       (symbol, analysis_date, trend, momentum, volatility, rsi, macd_value, macd_signal, ma_5, ma_20, ma_50, analysis_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (symbol, analysis_date) DO UPDATE SET
         trend = EXCLUDED.trend,
         momentum = EXCLUDED.momentum,
         volatility = EXCLUDED.volatility,
         rsi = EXCLUDED.rsi,
         macd_value = EXCLUDED.macd_value,
         macd_signal = EXCLUDED.macd_signal,
         ma_5 = EXCLUDED.ma_5,
         ma_20 = EXCLUDED.ma_20,
         ma_50 = EXCLUDED.ma_50,
         analysis_data = EXCLUDED.analysis_data`,
      [
        symbol,
        date,
        indicators.trend,
        indicators.momentum,
        indicators.volatility,
        indicators.rsi,
        indicators.macd.value,
        indicators.macd.signal,
        indicators.movingAverages.ma5,
        indicators.movingAverages.ma20,
        indicators.movingAverages.ma50,
        JSON.stringify(indicators)
      ]
    );
  } finally {
    client.release();
  }
}

/**
 * Get cached technical analysis
 */
export async function getTechnicalAnalysis(symbol: string): Promise<TechnicalIndicators | null> {
  const client = await pool.connect();

  try {
    const result = await client.query(
      `SELECT analysis_data FROM technical_analysis 
       WHERE symbol = $1 
       ORDER BY analysis_date DESC 
       LIMIT 1`,
      [symbol]
    );

    if (result.rows.length > 0) {
      return result.rows[0].analysis_data;
    }
    return null;
  } finally {
    client.release();
  }
}

/**
 * Store market context
 */
export async function storeMarketContext(context: MarketContext) {
  const client = await pool.connect();

  try {
    await client.query(
      `INSERT INTO market_context_cache 
       (context_date, nifty_50_change, market_sentiment, sector_performance, volume_trend, context_data)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (context_date) DO UPDATE SET
         nifty_50_change = EXCLUDED.nifty_50_change,
         market_sentiment = EXCLUDED.market_sentiment,
         sector_performance = EXCLUDED.sector_performance,
         volume_trend = EXCLUDED.volume_trend,
         context_data = EXCLUDED.context_data`,
      [
        new Date().toISOString().split('T')[0],
        context.nifty50Change,
        context.marketSentiment,
        JSON.stringify(context),
        context.volumeTrend,
        JSON.stringify(context)
      ]
    );
  } finally {
    client.release();
  }
}

/**
 * Get today's market context
 */
export async function getTodayMarketContext(): Promise<MarketContext | null> {
  const client = await pool.connect();

  try {
    const result = await client.query(
      `SELECT context_data FROM market_context_cache 
       WHERE context_date = CURRENT_DATE`
    );

    if (result.rows.length > 0) {
      return result.rows[0].context_data;
    }
    return null;
  } finally {
    client.release();
  }
}
