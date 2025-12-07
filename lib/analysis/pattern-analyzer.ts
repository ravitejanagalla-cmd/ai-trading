import { ILLMProvider } from '@/lib/llm';
import { pool } from '@/lib/data/db';
import { calculateIndicators } from './data-fetcher';

export interface PatternAnalysis {
  patterns: Pattern[];
  supportLevels: number[];
  resistanceLevels: number[];
  recommendation: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  reasoning: string;
  riskFactors: string[];
}

export interface Pattern {
  type: string;
  confidence: number;
  description: string;
  target?: number;
  stopLoss?: number;
}

/**
 * Analyze stock using LLM to detect patterns and provide recommendations
 */
export async function analyzeWithLLM(
  llm: ILLMProvider,
  symbol: string,
  data: { current: any; historical: any[]; news: any[] }
): Promise<PatternAnalysis> {
  
  // Calculate technical indicators
  const indicators = calculateIndicators(data.historical);
  
  // Build analysis prompt with previous analysis
  const prompt = await buildAnalysisPrompt(symbol, data, indicators);
  
  // Get LLM analysis using direct API call
  try {
    const axios = await import('axios');
    const baseUrl = process.env.LMSTUDIO_BASE_URL || 'http://localhost:1234/v1';
    
    const response = await axios.default.post(`${baseUrl}/chat/completions`, {
      model: 'local-model',
      messages: [
        {
          role: 'system',
          content: 'You are an expert stock market analyst. Always respond with valid JSON only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 2000
    });

    const content = response.data.choices[0].message.content;
    const analysis = parseAnalysisResponse(content);
    
    // Store analysis in database
    await storeAnalysis(symbol, analysis);
    
    return analysis;
  } catch (error) {
    console.error('LLM analysis error:', error);
    
    // Return basic analysis as fallback
    return generateFallbackAnalysis(symbol, indicators);
  }
}

/**
 * Get previous analysis for a symbol to help AI learn
 */
async function getPreviousAnalysis(symbol: string, limit: number = 3): Promise<any[]> {
  try {
    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        SELECT analysis_date, patterns, recommendation, confidence, reasoning, created_at
        FROM stock_analysis
        WHERE symbol = $1
        ORDER BY analysis_date DESC
        LIMIT $2
      `, [symbol, limit]);

      return result.rows.map(row => ({
        date: row.analysis_date,
        patterns: row.patterns,
        recommendation: row.recommendation,
        confidence: row.confidence,
        reasoning: row.reasoning,
        analyzedAt: row.created_at
      }));
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error fetching previous analysis:', error);
    return [];
  }
}

/**
 * Build comprehensive analysis prompt for LLM
 */
async function buildAnalysisPrompt(symbol: string, data: any, indicators: any): Promise<string> {
  const current = data.current;
  const historical = data.historical;
  
  // Get recent price action
  const recentPrices = historical.slice(0, 10).map((d: any) => ({
    date: d.date,
    close: d.close,
    volume: d.volume
  }));

  // Get previous analysis
  const previousAnalysis = await getPreviousAnalysis(symbol, 3);

  let previousAnalysisSection = '';
  if (previousAnalysis.length > 0) {
    previousAnalysisSection = `\n**PREVIOUS ANALYSIS HISTORY:**
You have analyzed this stock before. Learn from your past decisions:

${previousAnalysis.map((pa: any, idx: number) => `
Analysis #${idx + 1} (${pa.date}):
- Recommendation: ${pa.recommendation}
- Confidence: ${(pa.confidence * 100).toFixed(0)}%
- Reasoning: ${pa.reasoning}
- Patterns: ${JSON.stringify(pa.patterns)}
`).join('\n')}

Consider:
1. Have market conditions changed since your last analysis?
2. Were your previous predictions accurate?
3. Should you adjust your confidence based on past performance?
`;
  }

  return `You are an expert stock market analyst specializing in Indian equities. Analyze ${symbol} and provide trading insights.

**CURRENT DATA:**
- Symbol: ${symbol}
- Current Price: ₹${current?.close || 'N/A'}
- Day Change: ${current?.change || 'N/A'}%
- Volume: ${current?.totalTradedVolume || 'N/A'}

**TECHNICAL INDICATORS:**
- Trend: ${indicators.trend}
- 5-day MA: ₹${indicators.ma5}
- 20-day MA: ₹${indicators.ma20}
- Momentum (5d): ${indicators.momentum}%
- Volatility: ${indicators.volatility}

**RECENT PRICE ACTION (Last 10 days):**
${JSON.stringify(recentPrices, null, 2)}

**NEWS & EVENTS:**
${data.news.map((n: any) => `- [${n.source}] ${n.title}: ${n.summary.substring(0, 150)}...`).join('\n')}
${previousAnalysisSection}

**YOUR TASK:**
Analyze this data and provide a JSON response with the following structure:

{
  "patterns": [
    {
      "type": "string (e.g., 'Ascending Triangle', 'Double Bottom')",
      "confidence": number (0-1),
      "description": "string",
      "target": number (price target if pattern completes),
      "stopLoss": number (suggested stop loss)
    }
  ],
  "supportLevels": [number, number],
  "resistanceLevels": [number, number],
  "recommendation": "BUY" | "SELL" | "HOLD",
  "confidence": number (0-1),
  "reasoning": "string (detailed explanation)",
  "riskFactors": ["string", "string"]
}

Focus on:
1. Chart patterns visible in recent price action
2. Key support and resistance levels
3. Momentum and trend strength
4. Risk-reward ratio
5. Actionable trading recommendation
${previousAnalysis.length > 0 ? '6. How this analysis compares to your previous recommendations' : ''}

Respond ONLY with valid JSON.`;
}

/**
 * Parse LLM response into structured analysis
 */
function parseAnalysisResponse(response: string): PatternAnalysis {
  try {
    // Try to parse JSON directly
    const json = JSON.parse(response);
    return json as PatternAnalysis;
  } catch {
    // Try to extract JSON from markdown
    const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]) as PatternAnalysis;
    }
    
    // Try to find any JSON object
    const objectMatch = response.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      return JSON.parse(objectMatch[0]) as PatternAnalysis;
    }
    
    throw new Error('Could not parse LLM response');
  }
}

/**
 * Store analysis results in database
 */
async function storeAnalysis(symbol: string, analysis: PatternAnalysis): Promise<void> {
  try {
    const client = await pool.connect();
    
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS stock_analysis (
          id SERIAL PRIMARY KEY,
          symbol VARCHAR(20) NOT NULL,
          analysis_date DATE NOT NULL,
          patterns JSONB,
          recommendation VARCHAR(50),
          confidence FLOAT,
          reasoning TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(symbol, analysis_date)
        );
      `);

      await client.query(`
        INSERT INTO stock_analysis (symbol, analysis_date, patterns, recommendation, confidence, reasoning)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (symbol, analysis_date) 
        DO UPDATE SET patterns = EXCLUDED.patterns, recommendation = EXCLUDED.recommendation,
                      confidence = EXCLUDED.confidence, reasoning = EXCLUDED.reasoning
      `, [
        symbol,
        new Date().toISOString().split('T')[0],
        JSON.stringify(analysis.patterns),
        analysis.recommendation,
        analysis.confidence,
        analysis.reasoning
      ]);

      console.log(`✅ Stored analysis for ${symbol}`);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error storing analysis:', error);
  }
}

/**
 * Store news events in database
 */
export async function storeNewsEvents(symbol: string, news: any[]): Promise<void> {
  if (!news || news.length === 0) return;

  try {
    const client = await pool.connect();
    
    try {
      // Create table if not exists
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
      `);

      // Add new columns if they don't exist (migration)
      await client.query(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='news_events' AND column_name='category') THEN
            ALTER TABLE news_events ADD COLUMN category VARCHAR(50);
          END IF;
          
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='news_events' AND column_name='sentiment') THEN
            ALTER TABLE news_events ADD COLUMN sentiment VARCHAR(20);
          END IF;
          
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='news_events' AND column_name='impact') THEN
            ALTER TABLE news_events ADD COLUMN impact VARCHAR(20);
          END IF;
          
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='news_events' AND column_name='url') THEN
            ALTER TABLE news_events ADD COLUMN url TEXT;
          END IF;
        END $$;
      `);

      // Create indexes if they don't exist
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_news_symbol ON news_events(symbol, event_date DESC);
        CREATE INDEX IF NOT EXISTS idx_news_category ON news_events(category);
        CREATE INDEX IF NOT EXISTS idx_news_sentiment ON news_events(sentiment);
      `);

      for (const item of news) {
        await client.query(`
          INSERT INTO news_events (symbol, event_date, title, summary, source, category, sentiment, impact, impact_score, url)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT DO NOTHING
        `, [
          symbol,
          item.date,
          item.title,
          item.summary || '',
          item.source,
          item.category || 'general',
          item.sentiment || 'neutral',
          item.impact || 'medium',
          item.impact === 'high' ? 0.8 : item.impact === 'low' ? 0.3 : 0.5,
          item.url || ''
        ]);
      }
      console.log(`✅ Stored ${news.length} analyzed news items for ${symbol}`);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error storing news:', error);
  }
}

/**
 * Generate fallback analysis using technical indicators
 */
function generateFallbackAnalysis(symbol: string, indicators: any): PatternAnalysis {
  const { trend, momentum, currentPrice, ma5, ma20 } = indicators;
  
  // Simple rule-based recommendation
  let recommendation: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
  let confidence = 0.5;
  let reasoning = '';

  if (trend === 'Bullish' && momentum > 2) {
    recommendation = 'BUY';
    confidence = 0.7;
    reasoning = `${symbol} shows bullish trend with positive momentum. Price (₹${currentPrice}) is above both 5-day MA (₹${ma5}) and 20-day MA (₹${ma20}). Momentum: +${momentum}%`;
  } else if (trend === 'Bearish' && momentum < -2) {
    recommendation = 'SELL';
    confidence = 0.7;
    reasoning = `${symbol} shows bearish trend with negative momentum. Price (₹${currentPrice}) is below key moving averages. Momentum: ${momentum}%`;
  } else {
    reasoning = `${symbol} is in a ${trend.toLowerCase()} trend. Current momentum: ${momentum}%. Waiting for clearer signals.`;
  }

  // Simple support/resistance based on MAs
  const supportLevels = [ma20 * 0.98, ma5 * 0.97];
  const resistanceLevels = [ma5 * 1.03, ma20 * 1.05];

  return {
    patterns: [
      {
        type: `${trend} Trend`,
        confidence: confidence,
        description: `Stock is currently in a ${trend.toLowerCase()} trend based on moving averages`,
        target: trend === 'Bullish' ? currentPrice * 1.05 : undefined,
        stopLoss: currentPrice * 0.95
      }
    ],
    supportLevels,
    resistanceLevels,
    recommendation,
    confidence,
    reasoning,
    riskFactors: [
      'Analysis based on technical indicators only',
      'Market conditions can change rapidly',
      'Consider fundamental analysis before trading'
    ]
  };
}

