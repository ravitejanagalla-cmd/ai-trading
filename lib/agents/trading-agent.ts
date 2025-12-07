import { ILLMProvider } from '../llm';
import { PortfolioManager } from './portfolio-manager';
import { TRADING_AGENT_SYSTEM_PROMPT, createAgentInputMessage } from './prompt';
import { 
  AgentInput, 
  TradingDecision, 
  Order, 
  OHLCVData, 
  NewsItem,
  TradingConfig 
} from '../types';

/**
 * Main trading agent that orchestrates decision making
 */
export class TradingAgent {
  private llmProvider: ILLMProvider;
  private portfolio: PortfolioManager;
  private config: TradingConfig;
  private dailyTradeCount: number = 0;
  private currentDate: string = '';

  constructor(
    llmProvider: ILLMProvider,
    portfolio: PortfolioManager,
    config: TradingConfig
  ) {
    this.llmProvider = llmProvider;
    this.portfolio = portfolio;
    this.config = config;
  }

  /**
   * Process a trading day and generate decisions
   */
  async processTradingDay(
    date: string,
    marketData: Record<string, { latestCandle: OHLCVData; history?: OHLCVData[] }>,
    news: NewsItem[],
    fundamentals?: Record<string, any>
  ): Promise<TradingDecision> {
    // Reset daily trade count for new day
    if (date !== this.currentDate) {
      this.dailyTradeCount = 0;
      this.currentDate = date;
    }

    // Get current prices for portfolio valuation
    const currentPrices: Record<string, number> = {};
    for (const [symbol, data] of Object.entries(marketData)) {
      currentPrices[symbol] = data.latestCandle.close;
    }

    // Get account status
    const accountStatus = this.portfolio.getAccountStatus(currentPrices);

    // Create agent input
    const tickers = Object.keys(marketData);
    const agentInput: AgentInput = {
      mode: 'replay',
      timestamp: `${date}T15:30:00+05:30`, // IST market close
      tickers,
      marketData,
      news,
      fundamentals,
      account: accountStatus,
      marketRules: {
        lotSize: this.createLotSizeMap(tickers),
        tradingHours: this.config.marketRules.tradingHours,
        tickSize: this.createTickSizeMap(tickers),
        circuitLimitPct: this.config.marketRules.circuitLimitPct
      },
      config: this.config.agentConfig,
      instructions: {
        goal: 'Conservative alpha generation with capital preservation for Indian equities',
        allowedOrderTypes: ['market', 'limit'],
        reportingMode: 'json_only'
      }
    };

    // Generate decision from LLM
    let decision: TradingDecision;
    try {
      decision = await this.llmProvider.generateTradingDecision(
        TRADING_AGENT_SYSTEM_PROMPT,
        agentInput
      );
    } catch (error) {
      console.error('Error generating trading decision:', error);
      // Return empty decision
      return this.createEmptyDecision(date, 'LLM generation failed');
    }

    // Validate and execute orders
    const validatedOrders: Order[] = [];

    for (const order of decision.orders) {
      // Check daily trade limit
      if (this.dailyTradeCount >= this.config.agentConfig.maxDailyTrades) {
        console.warn(`⚠️ Max daily trades reached (${this.config.agentConfig.maxDailyTrades})`);
        decision.diagnostics.ruleViolations.push('max_daily_trades_exceeded');
        break;
      }

      // Validate order
      const validation = this.portfolio.validateOrder(
        order,
        currentPrices,
        this.config.agentConfig
      );

      if (!validation.valid) {
        console.warn(`⚠️ Order rejected: ${validation.reason}`, order);
        decision.diagnostics.ruleViolations.push(validation.reason || 'validation_failed');
        continue;
      }

      // Execute order
      const success = this.portfolio.executeOrder(order);

      if (success) {
        validatedOrders.push(order);
        this.dailyTradeCount++;

        // Log trade
        await this.portfolio.logTrade(date, order, currentPrices);
      }
    }

    // Update decision with only executed orders
    decision.orders = validatedOrders;

    // Update portfolio updates
    decision.portfolioUpdates = this.portfolio.getAccountStatus(currentPrices);

    return decision;
  }

  /**
   * Create empty decision (no trades)
   */
  private createEmptyDecision(timestamp: string, reason: string): TradingDecision {
    return {
      timestamp,
      orders: [],
      portfolioUpdates: undefined,
      diagnostics: {
        summary: reason,
        keySignals: [],
        confidenceOverall: 0,
        expectedPortfolioChange: {
          cashDelta: 0,
          positionChanges: {}
        },
        ruleViolations: []
      }
    };
  }

  /**
   * Create lot size map (1 for most Indian equities)
   */
  private createLotSizeMap(tickers: string[]): Record<string, number> {
    const lotSizes: Record<string, number> = {};
    for (const ticker of tickers) {
      lotSizes[ticker] = 1; // Most Indian equities trade in single shares
    }
    return lotSizes;
  }

  /**
   * Create tick size map
   */
  private createTickSizeMap(tickers: string[]): Record<string, number> {
    const tickSizes: Record<string, number> = {};
    for (const ticker of tickers) {
      tickSizes[ticker] = 0.05; // ₹0.05 tick size for most stocks
    }
    return tickSizes;
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(currentPrices: Record<string, number>) {
    return this.portfolio.getPerformanceMetrics(currentPrices);
  }

  /**
   * Get trade history
   */
  getTradeHistory() {
    return this.portfolio.getTradeHistory();
  }
}
