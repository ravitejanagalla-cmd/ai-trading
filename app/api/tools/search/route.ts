import { NextRequest, NextResponse } from 'next/server';
import { GeminiProvider } from '@/lib/llm/gemini-provider';

/**
 * POST /api/tools/search
 * Search for market information using Gemini grounding
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, maxResults = 5 } = body;

    if (!query) {
      return NextResponse.json(
        { success: false, error: 'query required' },
        { status: 400 }
      );
    }

    // Initialize Gemini provider
    const gemini = new GeminiProvider();
    
    // Search using Google Search grounding
    const results = await gemini.searchMarketInfo(query, maxResults);

    return NextResponse.json({
      success: true,
      query,
      results
    });
  } catch (error) {
    console.error('Error searching:', error);
    return NextResponse.json(
      { success: false, error: 'Search failed' },
      { status: 500 }
    );
  }
}
