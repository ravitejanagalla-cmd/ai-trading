import { NextRequest, NextResponse } from 'next/server';
import { searchTicker } from '@/lib/analysis/ticker-search';
import { fetchComprehensiveData } from '@/lib/analysis/data-fetcher';
import { analyzeWithLLM, analyzeWithLLM as analyzeWithLLMFallback } from '@/lib/analysis/pattern-analyzer';
import { LMStudioProvider } from '@/lib/llm/lmstudio-provider';
import {
  storeEnrichedNews,
  storeMarketContext,
  getRecentNews,
  getTodayMarketContext,
  storeFundamentalData,
  getFundamentalData,
  storeTechnicalAnalysis,
  getTechnicalAnalysis
} from '@/lib/data/enriched-data';
import { fetchEnhancedNews } from '@/lib/scrapers/enhanced-news-fetcher';
import { getFundamentalData as fetchNewFundamentals } from '@/lib/scrapers/fundamental-data';

/**
 * POST /api/analyze/stock
 * Main endpoint for comprehensive stock analysis with enriched data
 */
export async function POST(request: NextRequest) {
  try {
    const { ticker, days = 90 } = await request.json();

    if (!ticker) {
      return NextResponse.json(
        { success: false, error: 'Ticker required' },
        { status: 400 }
      );
    }

    console.log(`🔍 Starting analysis for: ${ticker}`);

    // Step 1: Search and validate ticker
    const matches = await searchTicker(ticker);
    
    if (matches.length === 0) {
      return NextResponse.json(
        { success: false, error: `No matches found for "${ticker}"` },
        { status: 404 }
      );
    }

    const symbol = matches[0].symbol;
    console.log(`✅ Matched to symbol: ${symbol} (${matches[0].name})`);

    // Step 2: Fetch comprehensive data with enrichment
    const [baseData, enhancedNews, cachedFundamentals, cachedTechnical, marketContext] = await Promise.all([
      fetchComprehensiveData(symbol, days),
      fetchEnhancedNews(symbol, 7).catch(() => []),
      getFundamentalData(symbol).catch(() => null),
      getTechnicalAnalysis(symbol).catch(() => null),
      getTodayMarketContext().catch(() => null)
    ]);
    
    if (baseData.error) {
      return NextResponse.json(
        { 
          success: false, 
          error: baseData.error,
          suggestion: 'This stock may not be available on NSE or data fetching failed. Try another symbol.'
        },
        { status: 500 }
      );
    }

    // Validate data
    if (!baseData.historical || baseData.historical.length < 5) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Insufficient historical data for ${symbol}. Only ${baseData.historical?.length || 0} days available.`,
          suggestion: 'Try a more actively traded stock like TCS, RELIANCE, or INFY.'
        },
        { status: 400 }
      );
    }

    console.log(`📊 Data fetched: ${baseData.historical.length} days of history, ${enhancedNews.length} news items`);

    // Step 3: Enrich data with better fundamentals if needed
    let enrichedFundamentals = cachedFundamentals;
    if (!enrichedFundamentals) {
      console.log(`📈 Fetching fresh fundamental data for ${symbol}...`);
      enrichedFundamentals = await fetchNewFundamentals(symbol);
      if (enrichedFundamentals) {
        await storeFundamentalData(symbol, enrichedFundamentals).catch(err =>
          console.warn('Failed to cache fundamentals:', err)
        );
      }
    }

    // Step 4: Store enhanced news in database
    if (enhancedNews.length > 0) {
      await storeEnrichedNews(symbol, enhancedNews).catch(err =>
        console.warn('Failed to store enriched news:', err)
      );
    }

    // Step 5: Store market context
    if (marketContext) {
      await storeMarketContext(marketContext).catch(err =>
        console.warn('Failed to store market context:', err)
      );
    }

    // Step 6: Build enriched data context for LLM
    const enrichedData = {
      ...baseData,
      news: enhancedNews.length > 0 ? enhancedNews : baseData.news,
      fundamentals: enrichedFundamentals || {},
      technicalIndicators: cachedTechnical || {},
      marketContext: marketContext || {
        nifty50Change: 0,
        marketSentiment: 'neutral',
        sectorPerformance: 'neutral',
        volumeTrend: 'average'
      }
    };

    console.log(`📊 Enriched data prepared: ${enhancedNews.length} news items, fundamentals available`);

    // Step 7: Analyze with LLM (GPT-OSS 20B)
    const llm = new LMStudioProvider('gpt-oss-20b');

    const analysis = await analyzeWithLLMWithContext(llm, symbol, enrichedData);
    
    // Validate analysis quality
    if (analysis.confidence < 0.3) {
      console.warn(`⚠️ Low confidence analysis for ${symbol}: ${analysis.confidence}`);
    }
    
    console.log(`✅ Analysis complete: ${analysis.recommendation} (confidence: ${analysis.confidence})`);

    // Return enriched results
    return NextResponse.json({
      success: true,
      symbol,
      symbolInfo: {
        name: matches[0].name,
        matchScore: matches[0].score
      },
      data: {
        current: baseData.current,
        historicalDays: baseData.historical.length,
        newsCount: enhancedNews.length,
        hasFundamentals: !!enrichedFundamentals,
        hasTechnicalIndicators: !!cachedTechnical
      },
      analysis,
      enrichmentMetadata: {
        newsSourcesUsed: enhancedNews.length > 0 ? 'Multiple (Finnhub, NewsAPI, Alpha Vantage)' : 'Base sources',
        fundamentalsSource: enrichedFundamentals ? 'Yahoo Finance / Finnhub' : 'Not available',
        marketContextAvailable: !!marketContext
      }
    });
  } catch (error) {
    console.error('Stock analysis error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Analysis failed'
      },
      { status: 500 }
    );
  }
}

/**
 * Enhanced LLM analysis with enriched context
 */
async function analyzeWithLLMWithContext(llm: any, symbol: string, enrichedData: any) {
  // Build a rich context string for the LLM
  const contextString = buildContextForLLM(symbol, enrichedData);

  // Use the LLM to analyze with enriched context
  const analysisPrompt = `
Given the following enriched market data for ${symbol}, provide a comprehensive investment analysis:

${contextString}

Provide your analysis in JSON format with:
- recommendation: "BUY" | "SELL" | "HOLD"
- confidence: 0-1 confidence score
- reasoning: detailed explanation
- patterns: detected price patterns
- supportLevels: support price levels
- resistanceLevels: resistance price levels
- riskFactors: identified risks
`;

  try {
    const response = await llm.query(analysisPrompt);
    
    // Parse the LLM response
    const analysisText = typeof response === 'string' ? response : response.content;
    
    // Try to extract JSON from the response
    const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    // Fallback: use the basic analysis
    return await analyzeWithLLMFallback(llm, symbol, enrichedData);
  } catch (error) {
    console.warn('Enriched LLM analysis failed, falling back:', error);
    return await analyzeWithLLMFallback(llm, symbol, enrichedData);
  }
}

/**
 * Build rich context string from enriched data
 */
function buildContextForLLM(symbol: string, enrichedData: any): string {
  let context = '';

  // Current price and technicals
  if (enrichedData.current) {
    context += `\n📊 Current Price: ₹${enrichedData.current.price}\n`;
    context += `Change: ${enrichedData.current.change} (${enrichedData.current.changePercent}%)\n`;
  }

  // Fundamentals
  if (enrichedData.fundamentals && Object.keys(enrichedData.fundamentals).length > 0) {
    const fund = enrichedData.fundamentals;
    context += `\n💼 Fundamentals:\n`;
    if (fund.peRatio) context += `P/E Ratio: ${fund.peRatio}\n`;
    if (fund.pbRatio) context += `P/B Ratio: ${fund.pbRatio}\n`;
    if (fund.roe) context += `ROE: ${(fund.roe * 100).toFixed(2)}%\n`;
    if (fund.debtToEquity) context += `Debt/Equity: ${fund.debtToEquity.toFixed(2)}\n`;
    if (fund.marketCap) context += `Market Cap: ₹${(fund.marketCap / 1e9).toFixed(2)}B\n`;
  }

  // Technical indicators
  if (enrichedData.technicalIndicators && Object.keys(enrichedData.technicalIndicators).length > 0) {
    const tech = enrichedData.technicalIndicators;
    context += `\n📈 Technical Indicators:\n`;
    if (tech.trend) context += `Trend: ${tech.trend}\n`;
    if (tech.momentum) context += `Momentum: ${tech.momentum.toFixed(2)}%\n`;
    if (tech.rsi) context += `RSI: ${tech.rsi.toFixed(2)}\n`;
    if (tech.movingAverages?.ma5) context += `MA5: ₹${tech.movingAverages.ma5.toFixed(2)}\n`;
    if (tech.movingAverages?.ma20) context += `MA20: ₹${tech.movingAverages.ma20.toFixed(2)}\n`;
  }

  // News sentiment
  if (enrichedData.news && enrichedData.news.length > 0) {
    const bullishCount = enrichedData.news.filter((n: any) => n.sentiment === 'bullish').length;
    const bearishCount = enrichedData.news.filter((n: any) => n.sentiment === 'bearish').length;
    context += `\n📰 Recent News (${enrichedData.news.length} articles):\n`;
    context += `Sentiment: ${bullishCount} Bullish, ${bearishCount} Bearish\n`;
    
    // Include top news headlines
    enrichedData.news.slice(0, 5).forEach((article: any, idx: number) => {
      context += `${idx + 1}. ${article.title} (${article.sentiment})\n`;
    });
  }

  // Market context
  if (enrichedData.marketContext) {
    context += `\n🌍 Market Context:\n`;
    context += `Sentiment: ${enrichedData.marketContext.marketSentiment}\n`;
    if (enrichedData.marketContext.nifty50Change) {
      context += `NIFTY 50: ${enrichedData.marketContext.nifty50Change > 0 ? '+' : ''}${enrichedData.marketContext.nifty50Change.toFixed(2)}%\n`;
    }
  }

  return context;
}
