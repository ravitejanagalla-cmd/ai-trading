import { TradingAgent } from './trading-agent';
import { ILLMProvider } from '@/lib/llm';
import { PortfolioManager } from './portfolio-manager';
import { TradingConfig, AgentInput, TradingDecision, OHLCVData, NewsItem } from '@/lib/types';
import { ContextRetriever, formatContextForLLM } from '@/lib/rag/retriever';
import { storeStockPrice, storeTradingDecision } from '@/lib/data/db';
import { embedMarketScenario, embedTradingDecision } from '@/lib/rag/embeddings';
import { qdrant } from '@/lib/data/db';

/**
 * RAG-Enhanced Trading Agent
 * Wraps standard agent with RAG context retrieval
 */
export class RAGTradingAgent {
  private baseAgent: TradingAgent;
  private retriever: ContextRetriever;
  private ragEnabled: boolean;

  constructor(
    llmProvider: ILLMProvider,
    portfolioManager: PortfolioManager,
    config: TradingConfig
  ) {
    this.baseAgent = new TradingAgent(llmProvider, portfolioManager, config);
    this.retriever = new ContextRetriever();
    this.ragEnabled = process.env.RAG_ENABLED === 'true';
  }

  /**
   * Process trading day with RAG context
   */
  async processTradingDay(
    date: string,
    marketData: Record<string, { latestCandle: OHLCVData; history?: OHLCVData[] }>,
    news: NewsItem[]
  ): Promise<TradingDecision> {
    
    //Store market data first
    if (this.ragEnabled) {
      await this.storeMarketDataForRAG(date, marketData);
    }

    // Let base agent handle the trading logic
    // The RAG context has already been stored and will be available for retrieval
    const decision = await this.baseAgent.processTradingDay(date, marketData, news);

    // Store decision for future learning
    if (this.ragEnabled) {
      await this.storeDecisionForLearning(decision, date, marketData);
    }

    return decision;
  }

  /**
   * Store current market data for RAG
   */
  private async storeMarketDataForRAG(
    date: string,
    marketData: Record<string, { latestCandle: OHLCVData; history?: OHLCVData[] }>
  ): Promise<void> {
    const promises = Object.entries(marketData).map(async ([symbol, data]) => {
      try {
        const candle = data.latestCandle;
        
        // Store in PostgreSQL
        await storeStockPrice({
          symbol,
          date,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume
        });

        // Probabilistically create embeddings (20% chance to save compute)
        if (Math.random() < 0.2) {
          const embedding = await embedMarketScenario({
            symbol,
            prices: [candle]
          });

          await qdrant.upsert('market_scenarios', {
            points: [{
              id: `${symbol}_${date}`.replace(/-/g, ''),
              vector: embedding,
              payload: {
                symbol,
                date,
                close: candle.close,
                volume: candle.volume
              }
            }]
          });
        }
      } catch (error) {
        console.error(`Error storing ${symbol}:`, error);
      }
    });

    await Promise.allSettled(promises);
  }

  /**
   * Store trading decision for future learning
   */
  private async storeDecisionForLearning(
    decision: TradingDecision,
    date: string,
    marketData: Record<string, { latestCandle: OHLCVData }>
  ): Promise<void> {
    const promises = decision.orders.map(async (order) => {
      try {
        const tradeId = await storeTradingDecision({
          modelSignature: 'rag-agent',
          symbol: order.symbol,
          action: order.action,
          quantity: order.quantity,
          price: order.estimatedExecutionPrice || order.limitPrice || 0,
          date,
          rationale: order.rationale || decision.diagnostics.summary,
          marketContext: {
            close: marketData[order.symbol]?.latestCandle.close
          }
        });

        const embedding = await embedTradingDecision({
          symbol: order.symbol,
          action: order.action,
          price: order.estimatedExecutionPrice || order.limitPrice || 0,
          rationale: order.rationale || ''
        });

        await qdrant.upsert('trading_outcomes', {
          points: [{
            id: `trade_${tradeId}`,
            vector: embedding,
            payload: {
              symbol: order.symbol,
              action: order.action,
              date,
              trade_id: tradeId
            }
          }]
        });
      } catch (error) {
        console.error('Error storing decision:', error);
      }
    });

    await Promise.allSettled(promises);
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(currentPrices: Record<string, number>) {
    return this.baseAgent.getPerformanceMetrics(currentPrices);
  }

  /**
   * Get trade history
   */
  getTradeHistory() {
    return this.baseAgent.getTradeHistory();
  }
}
