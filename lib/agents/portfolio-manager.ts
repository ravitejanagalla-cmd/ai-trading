import { AccountStatus, Position, Order, TradeLog } from '../types';
import fs from 'fs/promises';
import path from 'path';

/**
 * Portfolio manager handles account state, positions, and trade execution
 */
export class PortfolioManager {
  private cash: number;
  private positions: Map<string, Position> = new Map();
  private tradeHistory: TradeLog[] = [];
  private initialCash: number;
  private dataPath: string;

  constructor(initialCash: number, dataPath: string = './data') {
    this.cash = initialCash;
    this.initialCash = initialCash;
    this.dataPath = dataPath;
  }

  /**
   * Get current account status
   */
  getAccountStatus(currentPrices: Record<string, number>): AccountStatus {
    let portfolioValue = this.cash;
    const positionsObj: Record<string, number> = {};
    let totalPnl = 0;

    for (const [symbol, position] of this.positions.entries()) {
      positionsObj[symbol] = position.quantity;
      const currentPrice = currentPrices[symbol] || position.avgPrice;
      portfolioValue += position.quantity * currentPrice;
      
      // Update unrealized PnL
      position.currentPrice = currentPrice;
      position.unrealizedPnl = (currentPrice - position.avgPrice) * position.quantity;
      totalPnl += position.unrealizedPnl + position.realizedPnl;
    }

    return {
      cash: this.cash,
      positions: positionsObj,
      portfolioValue,
      buyingPower: this.cash, // Simplified - no margin
      totalPnl
    };
  }

  /**
   * Execute a buy order
   */
  buy(symbol: string, quantity: number, price: number): boolean {
    const cost = quantity * price;

    if (cost > this.cash) {
      console.warn(`Insufficient cash for buy order: ${symbol} x${quantity} @ ₹${price}`);
      return false;
    }

    this.cash -= cost;

    const existing = this.positions.get(symbol);
    if (existing) {
      // Average down/up
      const totalQuantity = existing.quantity + quantity;
      const totalCost = (existing.avgPrice * existing.quantity) + cost;
      existing.avgPrice = totalCost / totalQuantity;
      existing.quantity = totalQuantity;
    } else {
      this.positions.set(symbol, {
        symbol,
        quantity,
        avgPrice: price,
        currentPrice: price,
        unrealizedPnl: 0,
        realizedPnl: 0
      });
    }

    console.log(`✓ BUY ${symbol} x${quantity} @ ₹${price.toFixed(2)} | Cash: ₹${this.cash.toFixed(2)}`);
    return true;
  }

  /**
   * Execute a sell order
   */
  sell(symbol: string, quantity: number, price: number): boolean {
    const existing = this.positions.get(symbol);

    if (!existing || existing.quantity < quantity) {
      console.warn(`Insufficient position to sell: ${symbol} x${quantity}`);
      return false;
    }

    const proceeds = quantity * price;
    this.cash += proceeds;

    // Calculate realized P&L
    const realizedPnl = (price - existing.avgPrice) * quantity;
    existing.realizedPnl += realizedPnl;

    // Update position
    existing.quantity -= quantity;

    if (existing.quantity === 0) {
      this.positions.delete(symbol);
    }

    console.log(`✓ SELL ${symbol} x${quantity} @ ₹${price.toFixed(2)} | P&L: ₹${realizedPnl.toFixed(2)} | Cash: ₹${this.cash.toFixed(2)}`);
    return true;
  }

  /**
   * Validate if an order can be executed
   */
  validateOrder(
    order: Order,
    currentPrices: Record<string, number>,
    config: any
  ): { valid: boolean; reason?: string } {
    const price = order.estimatedExecutionPrice;
    const symbol = order.symbol;

    if (order.action === 'buy') {
      const cost = order.quantity * price;

      // Check cash available
      if (cost > this.cash) {
        return { valid: false, reason: 'Insufficient cash' };
      }

      // Check max order value
      if (cost > config.maxOrderValue) {
        return { valid: false, reason: 'Exceeds max order value' };
      }

      // Check max position percentage
      const accountStatus = this.getAccountStatus(currentPrices);
      const positionValue = cost;
      const positionPct = positionValue / accountStatus.portfolioValue;

      if (positionPct > config.maxPositionPct) {
        return { valid: false, reason: `Exceeds max position % (${positionPct.toFixed(2)} > ${config.maxPositionPct})` };
      }

      // Check total exposure
      const totalExposure = (accountStatus.portfolioValue - this.cash + cost) / accountStatus.portfolioValue;
      if (totalExposure > config.maxTotalExposurePct) {
        return { valid: false, reason: 'Exceeds max total exposure' };
      }

      // Check minimum cash reserve
      const cashAfter = this.cash - cost;
      const cashReservePct = cashAfter / accountStatus.portfolioValue;
      if (cashReservePct < config.minCashReservePct) {
        return { valid: false, reason: 'Violates minimum cash reserve' };
      }
    } else if (order.action === 'sell') {
      const existing = this.positions.get(symbol);
      if (!existing || existing.quantity < order.quantity) {
        return { valid: false, reason: 'Insufficient position to sell' };
      }
    }

    return { valid: true };
  }

  /**
   * Execute an order
   */
  executeOrder(order: Order): boolean {
    if (order.action === 'buy') {
      return this.buy(order.symbol, order.quantity, order.estimatedExecutionPrice);
    } else if (order.action === 'sell') {
      return this.sell(order.symbol, order.quantity, order.estimatedExecutionPrice);
    }
    return false;
  }

  /**
   * Log a trade
   */
  async logTrade(date: string, order: Order, currentPrices: Record<string, number>) {
    const accountStatus = this.getAccountStatus(currentPrices);

    const log: TradeLog = {
      date,
      id: this.tradeHistory.length + 1,
      thisAction: {
        action: order.action,
        symbol: order.symbol,
        amount: order.quantity,
        price: order.estimatedExecutionPrice
      },
      positions: accountStatus.positions,
      portfolioValue: accountStatus.portfolioValue,
      pnl: accountStatus.totalPnl,
      reasoning: order.rationale
    };

    this.tradeHistory.push(log);

    // Save to file
    await this.saveTradeLog(log);
  }

  /**
   * Save trade log to JSONL file
   */
  private async saveTradeLog(log: TradeLog) {
    try {
      const logDir = path.join(this.dataPath, 'logs');
      await fs.mkdir(logDir, { recursive: true });

      const logFile = path.join(logDir, 'trades.jsonl');
      await fs.appendFile(logFile, JSON.stringify(log) + '\n');
    } catch (error) {
      console.error('Error saving trade log:', error);
    }
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(currentPrices: Record<string, number>) {
    const accountStatus = this.getAccountStatus(currentPrices);
    const totalReturn = ((accountStatus.portfolioValue - this.initialCash) / this.initialCash) * 100;

    return {
      initialCash: this.initialCash,
      currentValue: accountStatus.portfolioValue,
      totalReturn: totalReturn,
      totalPnl: accountStatus.totalPnl,
      cash: this.cash,
      numPositions: this.positions.size,
      numTrades: this.tradeHistory.length
    };
  }

  /**
   * Get trade history
   */
  getTradeHistory(): TradeLog[] {
    return this.tradeHistory;
  }

  /**
   * Reset portfolio (for new simulation)
   */
  reset() {
    this.cash = this.initialCash;
    this.positions.clear();
    this.tradeHistory = [];
  }
}
