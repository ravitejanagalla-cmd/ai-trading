// Market data types
export interface OHLCVData {
  symbol: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface NewsItem {
  id: string;
  time: string;
  source: string;
  title: string;
  summary: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
}

export interface FundamentalData {
  symbol: string;
  companyName: string;
  sector: string;
  industry: string;
  marketCap: number;
  peRatio: number;
  pbRatio: number;
  eps: number;
  dividendYield: number;
  debtToEquity: number;
  roe: number;
  roic: number;
  currentRatio: number;
  quickRatio: number;
  netMargin: number;
  operatingMargin: number;
  assetTurnover: number;
  bookValue: number;
  tangibleBookValue: number;
  priceToBook: number;
  priceToSales: number;
  evToEbitda: number;
  weekHigh50: number;
  weekLow50: number;
  weekChange52: number;
  beta: number;
  avgVolume: number;
  description?: string;
  website?: string;
  employees?: number;
}

// Account and portfolio types
export interface Position {
  symbol: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  realizedPnl: number;
}

export interface AccountStatus {
  cash: number;
  positions: Record<string, number>; // symbol -> quantity
  portfolioValue: number;
  buyingPower: number;
  totalPnl: number;
}

// Trading types
export type OrderAction = 'buy' | 'sell' | 'hold';
export type OrderType = 'market' | 'limit' | 'stop_limit';

export interface Signal {
  name: string;
  value: string;
  details?: string;
  score?: number;
}

export interface Order {
  orderId: string | null;
  simulated: boolean;
  action: OrderAction;
  symbol: string;
  quantity: number;
  orderType: OrderType;
  limitPrice?: number;
  stopPrice?: number;
  estimatedExecutionPrice: number;
  notional: number;
  riskToReward?: number;
  maxLossAmount?: number;
  confidence: number;
  rationale: string;
  signals: Signal[];
  constraintsChecked: {
    withinMaxPositionPct: boolean;
    withinMaxTotalExposurePct: boolean;
    withinMaxOrderValue: boolean;
    insideTradingHours: boolean;
  };
  explainableActions: string[];
}

export interface TradingDecision {
  timestamp: string;
  orders: Order[];
  portfolioUpdates?: Partial<AccountStatus>;
  diagnostics: {
    summary: string;
    keySignals: string[];
    confidenceOverall: number;
    expectedPortfolioChange?: {
      cashDelta: number;
      positionChanges: Record<string, number>;
    };
    ruleViolations: string[];
  };
}

// Agent input types
export interface AgentInput {
  mode: 'replay' | 'live' | 'paper-sim';
  timestamp: string;
  tickers: string[];
  marketData: Record<string, {
    latestCandle: OHLCVData;
    history?: OHLCVData[];
  }>;
  news: NewsItem[];
  fundamentals?: Record<string, FundamentalData>;
  account: AccountStatus;
  marketRules:  {
    lotSize: Record<string, number>;
    tradingHours: {
      start: string;
      end: string;
      timezone: string;
    };
    tickSize: Record<string, number>;
    circuitLimitPct?: number;
  };
  config: {
    maxPositionPct: number;
    maxTotalExposurePct: number;
    minCashReservePct: number;
    maxDailyTrades: number;
    allowMargin: boolean;
    slippageModel: {
      type: 'percent' | 'fixed';
      value: number;
    };
    maxOrderValue: number;
  };
  instructions: {
    goal: string;
    allowedOrderTypes: OrderType[];
    reportingMode: 'json_only' | 'json+human';
  };
}

// LLM Provider types
export type LLMProvider = 'gemini' | 'ollama' | 'lmstudio';

export interface ModelConfig {
  name: string;
  basemodel: string;
  provider: LLMProvider;
  signature: string;
  enabled: boolean;
}

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// Configuration types
export interface TradingConfig {
  agentType: string;
  market: 'india';
  dateRange: {
    initDate: string;
    endDate: string;
  };
  universe: string;
  models: ModelConfig[];
  agentConfig: {
    initialCash: number;
    maxPositionPct: number;
    maxTotalExposurePct: number;
    minCashReservePct: number;
    maxDailyTrades: number;
    allowMargin: boolean;
    slippageModel: {
      type: 'percent' | 'fixed';
      value: number;
    };
    maxOrderValue: number;
  };
  marketRules: {
    tradingHours: {
      start: string;
      end: string;
      timezone: string;
    };
    settlement: string;
    tickSize: number;
    circuitLimitPct: number;
  };
  logConfig: {
    logPath: string;
  };
}

// Trading log types
export interface TradeLog {
  date: string;
  id: number;
  thisAction: {
    action: OrderAction;
    symbol: string;
    amount: number;
    price: number;
  };
  positions: Record<string, number>;
  portfolioValue: number;
  pnl: number;
  reasoning?: string;
}
