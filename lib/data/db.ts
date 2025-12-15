import { Pool } from 'pg';
import { QdrantClient } from '@qdrant/js-client-rest';

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Qdrant connection
const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL || 'http://localhost:6333'
});

/**
 * Initialize database schemas
 */
export async function initializeDatabase() {
  const client = await pool.connect();
  
  try {
    // Create stock_prices table
    await client.query(`
      CREATE TABLE IF NOT EXISTS stock_prices (
        id SERIAL PRIMARY KEY,
        symbol VARCHAR(20) NOT NULL,
        date DATE NOT NULL,
        open DECIMAL(10,2),
        high DECIMAL(10,2),
        low DECIMAL(10,2),
        close DECIMAL(10,2),
        volume BIGINT,
        prev_close DECIMAL(10,2),
        change_pct DECIMAL(5,2),
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(symbol, date)
      );
      CREATE INDEX IF NOT EXISTS idx_symbol_date ON stock_prices(symbol, date DESC);
    `);

    // Create market_patterns table
    await client.query(`
      CREATE TABLE IF NOT EXISTS market_patterns (
        id SERIAL PRIMARY KEY,
        symbol VARCHAR(20) NOT NULL,
        date DATE NOT NULL,
        pattern_type VARCHAR(50),
        confidence FLOAT,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_pattern_symbol ON market_patterns(symbol, date DESC);
    `);

    // Create trading_history table
    await client.query(`
      CREATE TABLE IF NOT EXISTS trading_history (
        id SERIAL PRIMARY KEY,
        model_signature VARCHAR(100),
        symbol VARCHAR(20),
        action VARCHAR(10),
        quantity INT,
        price DECIMAL(10,2),
        date DATE,
        rationale TEXT,
        outcome_pnl DECIMAL(10,2),
        market_context JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_trading_symbol ON trading_history(symbol, date DESC);
      CREATE INDEX IF NOT EXISTS idx_trading_model ON trading_history(model_signature);
    `);

    // Create news_events table
    await client.query(`
      CREATE TABLE IF NOT EXISTS news_events (
        id SERIAL PRIMARY KEY,
        symbol VARCHAR(20),
        event_date DATE,
        title TEXT,
        summary TEXT,
        source VARCHAR(100),
        impact_score FLOAT,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_news_symbol ON news_events(symbol, event_date DESC);
    `);

    console.log('✅ PostgreSQL schemas initialized');
  } finally {
    client.release();
  }
}

/**
 * Initialize Qdrant collections
 */
export async function initializeQdrant() {
  const collections = [
    {
      name: 'market_scenarios',
      vector_size: 768, // For nomic-embed or similar
      description: 'Market conditions and scenarios'
    },
    {
      name: 'trading_outcomes',
      vector_size: 768,
      description: 'Past trading decisions and outcomes'
    },
    {
      name: 'pattern_library',
      vector_size: 768,
      description: 'Chart patterns and technical setups'
    }
  ];

  for (const collection of collections) {
    try {
      const exists = await qdrant.getCollection(collection.name);
      console.log(`Collection ${collection.name} already exists`);
    } catch {
      await qdrant.createCollection(collection.name, {
        vectors: {
          size: collection.vector_size,
          distance: 'Cosine'
        }
      });
      console.log(`✅ Created Qdrant collection: ${collection.name}`);
    }
  }
}

/**
 * Store stock price data
 */
export async function storeStockPrice(data: {
  symbol: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  prevClose?: number;
  changePct?: number;
}) {
  const client = await pool.connect();
  
  try {
    await client.query(
      `INSERT INTO stock_prices (symbol, date, open, high, low, close, volume, prev_close, change_pct)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (symbol, date) DO UPDATE SET
         open = EXCLUDED.open,
         high = EXCLUDED.high,
         low = EXCLUDED.low,
         close = EXCLUDED.close,
         volume = EXCLUDED.volume,
         prev_close = EXCLUDED.prev_close,
         change_pct = EXCLUDED.change_pct`,
      [data.symbol, data.date, data.open, data.high, data.low, data.close, data.volume, data.prevClose, data.changePct]
    );
  } finally {
    client.release();
  }
}

/**
 * Get historical price data
 */
export async function getHistoricalPrices(symbol: string, days: number = 30) {
  const client = await pool.connect();
  
  try {
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const result = await client.query(
      `SELECT * FROM stock_prices 
       WHERE symbol = $1 
       AND date >= $2
       AND date <= $3
       ORDER BY date DESC 
       LIMIT 1000`,
      [symbol, startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * Store trading decision
 */
export async function storeTradingDecision(data: {
  modelSignature: string;
  symbol: string;
  action: string;
  quantity: number;
  price: number;
  date: string;
  rationale: string;
  marketContext: any;
}) {
  const client = await pool.connect();
  
  try {
    const result = await client.query(
      `INSERT INTO trading_history 
       (model_signature, symbol, action, quantity, price, date, rationale, market_context)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        data.modelSignature,
        data.symbol,
        data.action,
        data.quantity,
        data.price,
        data.date,
        data.rationale,
        JSON.stringify(data.marketContext)
      ]
    );
    return result.rows[0].id;
  } finally {
    client.release();
  }
}

/**
 * Get similar trading history
 */
export async function getSimilarTrades(symbol: string, action: string, limit: number = 5) {
  const client = await pool.connect();
  
  try {
    const result = await client.query(
      `SELECT * FROM trading_history 
       WHERE symbol = $1 AND action = $2
       ORDER BY date DESC 
       LIMIT $3`,
      [symbol, action, limit]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * Update trade outcome with P&L
 */
export async function updateTradeOutcome(tradeId: number, pnl: number) {
  const client = await pool.connect();
  
  try {
    await client.query(
      `UPDATE trading_history 
       SET outcome_pnl = $1 
       WHERE id = $2`,
      [pnl, tradeId]
    );
  } finally {
    client.release();
  }
}

export { pool, qdrant };
