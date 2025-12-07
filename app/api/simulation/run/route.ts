import { NextRequest, NextResponse } from 'next/server';
import { TradingAgent } from '@/lib/agents/trading-agent';
import { RAGTradingAgent } from '@/lib/agents/rag-trading-agent';
import { PortfolioManager } from '@/lib/agents/portfolio-manager';
import { MultiLLMManager } from '@/lib/llm';
import { TradingConfig, OHLCVData, NewsItem } from '@/lib/types';

/**
 * POST /api/simulation/run
 * Run a live paper-trading simulation with current market data
 */
export async function POST(request: NextRequest) {
  try {
    const config: TradingConfig = await request.json();

    // Validate config
    if (!config.models || config.models.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one model required' },
        { status: 400 }
      );
    }

    // Initialize LLM manager
    const llmManager = new MultiLLMManager(config.models);

    // Check availability
    const availability = await llmManager.checkAvailability();
    console.log('Provider availability:', availability);
    
    // Check if RAG is enabled
    const ragEnabled = process.env.RAG_ENABLED === 'true';
    if (ragEnabled) {
      console.log('🧠 RAG mode enabled - will use historical context');
    }

    // Fetch NIFTY 50 constituents
    const nifty50Response = await fetch(`${request.nextUrl.origin}/api/data/nifty50`);
    const nifty50Data = await nifty50Response.json();
    
    if (!nifty50Data.success) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch NIFTY 50 data' },
        { status: 500 }
      );
    }

    const tickers = nifty50Data.constituents.slice(0, 10); // Use first 10 for demo
    console.log(`Trading universe: ${tickers.length} stocks -`, tickers.join(', '));

    // Log NIFTY 50 data fetch
    await fetch(`${request.nextUrl.origin}/api/debug/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'data_fetch',
        stage: 'nifty50_constituents',
        data: {
          count: tickers.length,
          symbols: tickers
        }
      })
    });

    // Fetch current market data for all tickers
    console.log('Fetching market data...');
    const quotesResponse = await fetch(`${request.nextUrl.origin}/api/data/nifty50`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbols: tickers })
    });
    
    const quotesData = await quotesResponse.json();
    if (!quotesData.success) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch market quotes' },
        { status: 500 }
      );
    }

    // Build market data structure
    const marketData: Record<string, { latestCandle: OHLCVData; history?: OHLCVData[] }> = {};
    for (const [symbol, quote] of Object.entries(quotesData.quotes)) {
      if (quote) {
        marketData[symbol] = {
          latestCandle: quote as OHLCVData,
          history: [] // Could add historical data here
        };
      }
    }

    console.log(`Market data loaded for ${Object.keys(marketData).length} symbols`);

    // Log market data
    await fetch(`${request.nextUrl.origin}/api/debug/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'market_data',
        stage: 'quotes_fetched',
        data: {
          symbolCount: Object.keys(marketData).length,
          samplePrices: Object.fromEntries(
            Object.entries(marketData).slice(0, 3).map(([sym, data]) => 
              [sym, { close: data.latestCandle.close, volume: data.latestCandle.volume }]
            )
          )
        }
      })
    });

    // Simulated news (in real scenario, would fetch from Gemini grounding)
    const news: NewsItem[] = [
      {
        id: 'n1',
        time: new Date().toISOString(),
        source: 'Market Update',
        title: 'Indian markets showing positive momentum',
        summary: 'NIFTY 50 trading at favorable levels with strong fundamentals across sectors.'
      }
    ];

    // Run simulation for each enabled model
    const results: any[] = [];

    for (const modelConfig of config.models) {
      if (!modelConfig.enabled) continue;

      const provider = llmManager.getProvider(modelConfig.signature);
      if (!provider) {
        console.warn(`Provider not available: ${modelConfig.signature}`);
        continue;
      }

      console.log(`\n=== Running ${modelConfig.name} ===\n`);

      // Initialize portfolio
      const portfolio = new PortfolioManager(
        config.agentConfig.initialCash,
        `./data/logs/${modelConfig.signature}`
      );

      // Create trading agent (RAG-enhanced if enabled)
      const agent = ragEnabled
        ? new RAGTradingAgent(provider, portfolio, config)
        : new TradingAgent(provider, portfolio, config);
      
      if (ragEnabled) {
        console.log(`🧠 Using RAG-enhanced agent for ${modelConfig.name}`);
      }

      try {
        // Process today's trading
        const today = new Date().toISOString().split('T')[0];
        
        console.log(`Processing trading day: ${today}`);
        
        // Log agent input
        const agentInput = {
          date: today,
          symbols: Object.keys(marketData),
          marketDataSample: Object.fromEntries(
            Object.entries(marketData).slice(0, 2).map(([sym, data]) => [sym, data.latestCandle])
          ),
          newsCount: news.length
        };
        
        await fetch(`${request.nextUrl.origin}/api/debug/logs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'llm_input',
            stage: 'agent_input',
            model: modelConfig.name,
            data: agentInput
          })
        });
        
        const decision = await agent.processTradingDay(
          today,
          marketData,
          news
        );

        console.log(`Decision made:`);
        console.log(`- Orders: ${decision.orders.length}`);
        console.log(`- Confidence: ${decision.diagnostics.confidenceOverall}`);
        console.log(`- Summary: ${decision.diagnostics.summary}`);
        
        // Log AI decision
        await fetch(`${request.nextUrl.origin}/api/debug/logs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'llm_output',
            stage: 'decision_made',
            model: modelConfig.name,
            data: {
              ordersCount: decision.orders.length,
              confidence: decision.diagnostics.confidenceOverall,
              summary: decision.diagnostics.summary,
              keySignals: decision.diagnostics.keySignals,
              orders: decision.orders.map(o => ({
                action: o.action,
                symbol: o.symbol,
                quantity: o.quantity,
                price: o.estimatedExecutionPrice
              }))
            }
          })
        });

        if (decision.orders.length > 0) {
          decision.orders.forEach((order, idx) => {
            console.log(`  Order ${idx + 1}: ${order.action} ${order.quantity} ${order.symbol} @ ₹${order.estimatedExecutionPrice}`);
          });
        }

        // Get final portfolio state
        const currentPrices: Record<string, number> = {};
        for (const [symbol, data] of Object.entries(marketData)) {
          currentPrices[symbol] = data.latestCandle.close;
        }

        const performance = agent.getPerformanceMetrics(currentPrices);

        const simulationResult = {
          model: modelConfig.name,
          signature: modelConfig.signature,
          date: today,
          ordersPlaced: decision.orders.length,
          decision: {
            summary: decision.diagnostics.summary,
            confidence: decision.diagnostics.confidenceOverall,
            keySignals: decision.diagnostics.keySignals,
            orders: decision.orders.map(o => ({
              action: o.action,
              symbol: o.symbol,
              quantity: o.quantity,
              price: o.estimatedExecutionPrice,
              rationale: o.rationale
            }))
          },
          portfolio: {
            cash: performance.cash,
            positions: decision.portfolioUpdates?.positions || {},
            totalValue: performance.currentValue,
            totalReturn: performance.totalReturn.toFixed(2) + '%',
            numTrades: performance.numTrades
          },
          status: 'success'
        };

        results.push(simulationResult);

      } catch (error) {
        console.error(`Error in ${modelConfig.name}:`, error);
        results.push({
          model: modelConfig.name,
          signature: modelConfig.signature,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return NextResponse.json({
      success: true,
      results,
      marketData: {
        symbolsAnalyzed: Object.keys(marketData).length,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Simulation error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Simulation failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/simulation/status
 * Get status of running simulations
 */
export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({
      success: true,
      message: 'Simulation API ready'
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to get status' },
      { status: 500 }
    );
  }
}
