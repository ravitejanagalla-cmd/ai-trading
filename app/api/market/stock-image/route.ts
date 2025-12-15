import { NextRequest, NextResponse } from 'next/server';
import { getPlaceholderImage } from '@/lib/utils/stock-images';

/**
 * @deprecated Stock images are now served from /public/logos/stocks/ directory
 * This endpoint is kept for backward compatibility only
 */
export async function GET(request: NextRequest) {
  try {
    const symbol = request.nextUrl.searchParams.get('symbol')?.toUpperCase();
    
    if (!symbol) {
      return NextResponse.json(
        { error: 'Symbol parameter required' },
        { status: 400 }
      );
    }

    // Return local logo path
    const imageUrl = `/logos/stocks/${symbol.toLowerCase()}.png`;
    
    return NextResponse.json({
      success: true,
      symbol,
      imageUrl,
    });
  } catch (error) {
    console.error('Error in stock image endpoint:', error);
    const symbol = new URL(request.url).searchParams.get('symbol') || 'UNKNOWN';
    
    return NextResponse.json({
      success: true,
      symbol,
      imageUrl: getPlaceholderImage(symbol),
    });
  }
}
