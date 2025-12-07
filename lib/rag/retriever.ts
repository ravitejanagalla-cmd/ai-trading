import { qdrant, pool, getHistoricalPrices, getSimilarTrades } from '../data/db';
import { embedMarketScenario, generateEmbedding } from './embeddings';

export interface TradingContext {
  similarScenarios: any[];
  pastTrades: any[];
  identifiedPatterns: any[];
  newsContext: any[];
  historicalPrices: any[];
}

/**
 * Main Context Retriever for RAG system
 */
export class ContextRetriever {
  private similarityThreshold: number;
  private maxExamples: number;

  constructor() {
    this.similarityThreshold = parseFloat(process.env.SIMILARITY_THRESHOLD || '0.7');
    this.maxExamples = parseInt(process.env.MAX_CONTEXT_EXAMPLES || '5');
  }

  /**
   * Build complete trading context for a symbol
   */
  async buildCompactContext(
    symbol: string,
    currentMarketData: { latestCandle: any; history?: any[] }
  ): Promise<TradingContext> {
    const [
      similarScenarios,
      pastTrades,
      historicalPrices,
      patterns
    ] = await Promise.all([
      this.getSimilarScenarios(symbol, currentMarketData),
      this.getRelevantTradeHistory(symbol),
      this.getHistoricalContext(symbol),
      this.getMatchingPatterns(symbol)
    ]);

    return {
      similarScenarios: similarScenarios.slice(0, 3), // Top 3
      pastTrades: pastTrades.slice(0, 3), // Top 3
      historicalPrices: historicalPrices.slice(0, 30), // Last 30 days
      identifiedPatterns: patterns.slice(0, 2), // Top 2
      newsContext: [] // TODO: Implement news retrieval
    };
  }

  /**
   * Find similar market scenarios using vector search
   */
  async getSimilarScenarios(
    symbol: string,
    currentMarketData: { latestCandle: any; history?: any[] }
  ): Promise<any[]> {
    try {
      // Get historical prices to build embedding
      const historicalPrices = await getHistoricalPrices(symbol, 10);
      
      if (historicalPrices.length === 0) {
        return [];
      }

      // Create embedding for current market state
      const embedding = await embedMarketScenario({
        symbol,
        prices: [
          currentMarketData.latestCandle,
          ...(currentMarketData.history || [])
        ]
      });

      // Search Qdrant for similar scenarios
      const searchResult = await qdrant.search('market_scenarios', {
        vector: embedding,
        limit: this.maxExamples,
        score_threshold: this.similarityThreshold,
        filter: {
          must: [
            {
              key: 'symbol',
              match: { value: symbol }
            }
          ]
        }
      });

      return searchResult.map(result => ({
        ...result.payload,
        similarity: result.score
      }));
    } catch (error) {
      console.error('Error finding similar scenarios:', error);
      return [];
    }
  }

  /**
   * Get relevant trade history from PostgreSQL
   */
  async getRelevantTradeHistory(symbol: string): Promise<any[]> {
    try {
      // Get both buy and sell history
      const [buys, sells] = await Promise.all([
        getSimilarTrades(symbol, 'buy', 3),
        getSimilarTrades(symbol, 'sell', 2)
      ]);

      return [...buys, ...sells].map(trade => ({
        action: trade.action,
        price: parseFloat(trade.price),
        date: trade.date,
        rationale: trade.rationale,
        outcome_pnl: trade.outcome_pnl ? parseFloat(trade.outcome_pnl) : null,
        context: trade.market_context
      }));
    } catch (error) {
      console.error('Error getting trade history:', error);
      return [];
    }
  }

  /**
   * Get historical price context
   */
  async getHistoricalContext(symbol: string): Promise<any[]> {
    try {
      const prices = await getHistoricalPrices(symbol, 30);
      
      return prices.map(p => ({
        date: p.date,
        close: parseFloat(p.close),
        volume: parseInt(p.volume),
        change_pct: p.change_pct ? parseFloat(p.change_pct) : null
      }));
    } catch (error) {
      console.error('Error getting historical prices:', error);
      return [];
    }
  }

  /**
   * Find matching chart patterns
   */
  async getMatchingPatterns(symbol: string): Promise<any[]> {
    try {
      const client = await pool.connect();
      
      try {
        const result = await client.query(
          `SELECT * FROM market_patterns 
           WHERE symbol = $1 
           AND confidence > 0.6
           ORDER BY date DESC 
           LIMIT $2`,
          [symbol, 5]
        );

        return result.rows.map(row => ({
          pattern_type: row.pattern_type,
          confidence: parseFloat(row.confidence),
          date: row.date,
          metadata: row.metadata
        }));
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error getting patterns:', error);
      return [];
    }
  }

  /**
   * Search for similar trading decisions in vector store
   */
  async findSimilarDecisions(
    symbol: string,
    action: string,
    rationale: string
  ): Promise<any[]> {
    try {
      const embedding = await generateEmbedding(`${action} ${symbol}: ${rationale}`);

      const searchResult = await qdrant.search('trading_outcomes', {
        vector: embedding,
        limit: 5,
        score_threshold: this.similarityThreshold,
        filter: {
          must: [
            {
              key: 'symbol',
              match: { value: symbol }
            }
          ]
        }
      });

      return searchResult.map(result => ({
        ...result. payload,
        similarity: result.score
      }));
    } catch (error) {
      console.error('Error finding similar decisions:', error);
      return [];
    }
  }
}

/**
 * Format context for LLM consumption (token-efficient)
 */
export function formatContextForLLM(context: TradingContext, symbol: string): string {
  let formatted = `\n[HISTORICAL CONTEXT FOR ${symbol}]\n\n`;

  // Similar scenarios
  if (context.similarScenarios.length > 0) {
    formatted += `SIMILAR PAST SCENARIOS (${context.similarScenarios.length}):\n`;
    context.similarScenarios.forEach((scenario, idx) => {
      formatted += `${idx + 1}. ${scenario.date}: ${scenario.summary || 'Similar market conditions'} (${(scenario.similarity * 100).toFixed(0)}% match)\n`;
      if (scenario.outcome) {
        formatted += `   Outcome: ${scenario.outcome}\n`;
      }
    });
    formatted += '\n';
  }

  // Past trades
  if (context.pastTrades.length > 0) {
    formatted += `PAST TRADES IN THIS STOCK (${context.pastTrades.length}):\n`;
    context.pastTrades.forEach((trade, idx) => {
      const pnl = trade.outcome_pnl !== null ? ` → ${trade.outcome_pnl > 0 ? '+' : ''}${trade.outcome_pnl.toFixed(2)}%` : '';
      formatted += `${idx + 1}. ${trade.date}: ${trade.action.toUpperCase()} @ ₹${trade.price.toFixed(2)}${pnl}\n`;
      if (trade.rationale && trade.rationale.length < 100) {
        formatted += `   Why: ${trade.rationale}\n`;
      }
    });
    formatted += '\n';
  }

  // Patterns
  if (context.identifiedPatterns.length > 0) {
    formatted += `IDENTIFIED PATTERNS:\n`;
    context.identifiedPatterns.forEach((pattern, idx) => {
      formatted += `${idx + 1}. ${pattern.pattern_type} (${(pattern.confidence * 100).toFixed(0)}% confidence) on ${pattern.date}\n`;
    });
    formatted += '\n';
  }

  // Price summary
  if (context.historicalPrices.length > 0) {
    const recent = context.historicalPrices.slice(0, 5);
    const avg5day = recent.reduce((sum, p) => sum + p.close, 0) / recent.length;
    const current = recent[0].close;
    const vsAvg = ((current - avg5day) / avg5day * 100).toFixed(2);
    
    formatted += `PRICE CONTEXT:\n`;
    formatted += `Current: ₹${current.toFixed(2)} (${vsAvg}% vs 5-day avg)\n`;
    formatted += `Recent trend: ${recent.map(p => p.close.toFixed(0)).join(' → ')}\n\n`;
  }

  return formatted;
}
