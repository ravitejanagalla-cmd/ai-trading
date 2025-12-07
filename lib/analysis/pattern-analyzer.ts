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
  
  // Build analysis prompt
  const prompt = buildAnalysisPrompt(symbol, data, indicators);
  
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
 * Build comprehensive analysis prompt for LLM
 */
function buildAnalysisPrompt(symbol: string, data: any, indicators: any): string {
  const current = data.current;
  const historical = data.historical;
  
  // Get recent price action
  const recentPrices = historical.slice(0, 10).map((d: any) => ({
    date: d.date,
    close: d.close,
    volume: d.volume
  }));

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
${data.news.map((n: any) => `- ${n.title}: ${n.summary}`).join('\n')}

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
          recommendation VARCHAR(10),
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

