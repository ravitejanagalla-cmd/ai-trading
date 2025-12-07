import { NextRequest, NextResponse } from 'next/server';
import { storeStockPrice, qdrant } from '@/lib/data/db';
import { embedMarketScenario } from '@/lib/rag/embeddings';

/**
 * POST /api/data/historical/store
 * Store historical price data and create embeddings
 */
export async function POST(request: NextRequest) {
  try {
    const { symbol, prices } = await request.json();

    if (!symbol || !prices || !Array.isArray(prices)) {
      return NextResponse.json(
        { success: false, error: 'symbol and prices array required' },
        { status: 400 }
      );
    }

    let storedCount = 0;
    let embeddingCount = 0;

    // Store each price point
    for (const price of prices) {
      try {
        await storeStockPrice({
          symbol,
          date: price.date,
          open: price.open,
          high: price.high,
          low: price.low,
          close: price.close,
          volume: price.volume,
          prevClose: price.prevClose,
          changePct: price.changePct
        });
        storedCount++;

        // Create embedding for this market scenario (every 5th day to save resources)
        if (storedCount % 5 === 0) {
          const embedding = await embedMarketScenario({
            symbol,
            prices: [price]
          });

          // Store in Qdrant
          await qdrant.upsert('market_scenarios', {
            points: [
              {
                id: `${symbol}_${price.date}`.replace(/-/g, ''),
                vector: embedding,
                payload: {
                  symbol,
                  date: price.date,
                  close: price.close,
                  volume: price.volume,
                  change_pct: price.changePct,
                  summary: `${symbol} @ ₹${price.close} (${price.changePct > 0 ? '+' : ''}${price.changePct?.toFixed(2)}%)`
                }
              }
            ]
          });
          embeddingCount++;
        }
      } catch (error) {
        console.error(`Error storing price for ${symbol} on ${price.date}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      stored: storedCount,
      embedded: embeddingCount
    });
  } catch (error) {
    console.error('Historical data storage error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Storage failed' },
      { status: 500 }
    );
  }
}
