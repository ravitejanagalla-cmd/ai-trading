import { NextRequest, NextResponse } from 'next/server';
import { searchTicker } from '@/lib/analysis/ticker-search';
import { fetchComprehensiveData } from '@/lib/analysis/data-fetcher';
import { analyzeWithLLM } from '@/lib/analysis/pattern-analyzer';
import { LMStudioProvider } from '@/lib/llm/lmstudio-provider';

/**
 * POST /api/analyze/stock
 * Main endpoint for comprehensive stock analysis
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

    // Step 2: Fetch comprehensive data
    const data = await fetchComprehensiveData(symbol, days);
    
    if (data.error) {
      return NextResponse.json(
        { success: false, error: data.error },
        { status: 500 }
      );
    }

    console.log(`📊 Data fetched: ${data.historical.length} days of history`);

    // Step 3: Analyze with LLM  
    const llm = new LMStudioProvider('gpt-oss-20b');

    const analysis = await analyzeWithLLM(llm, symbol, data);
    
    console.log(`✅ Analysis complete: ${analysis.recommendation} (confidence: ${analysis.confidence})`);

    // Return results
    return NextResponse.json({
      success: true,
      symbol,
      symbolInfo: {
        name: matches[0].name,
        matchScore: matches[0].score
      },
      data: {
        current: data.current,
        historicalDays: data.historical.length,
        newsCount: data.news.length
      },
      analysis
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
