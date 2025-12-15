import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

/**
 * GET /api/test/db
 * Test database connection and create tables manually
 */
export async function GET(request: NextRequest) {
  try {
    console.log('Testing database connection...');
    console.log('POSTGRES_URL exists:', !!process.env.POSTGRES_URL);
    
    const connectionString = process.env.POSTGRES_URL    
    const pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false }
    });

    const client = await pool.connect();
    
    try {
      // Test connection
      const result = await client.query('SELECT NOW()');
      console.log('Connected to database at:', result.rows[0].now);

      // Create tables
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
      console.log('✅ stock_prices table created');

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
      console.log('✅ market_patterns table created');

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
      console.log('✅ trading_history table created');

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
      console.log('✅ news_events table created');

      // List all tables
      const tables = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name;
      `);

      return NextResponse.json({
        success: true,
        message: 'Database initialized successfully',
        connectionTime: result.rows[0].now,
        tables: tables.rows.map(r => r.table_name),
        connectionString: connectionString ? connectionString.substring(0, 50) + '...' : 'undefined'
      });
    } finally {
      client.release();
      await pool.end();
    }
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
