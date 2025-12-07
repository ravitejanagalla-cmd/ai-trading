import axios from 'axios';

/**
 * Dynamic ticker search using NSE API
 */
export async function searchTicker(query: string): Promise<{ symbol: string; name: string; score: number }[]> {
  if (!query || query.length < 2) return [];

  try {
    // NSE search API endpoint
    const searchUrl = `https://www.nseindia.com/api/search/autocomplete?q=${encodeURIComponent(query)}`;
    
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.nseindia.com/'
      }
    });

    if (response.data && response.data.symbols) {
      // Parse NSE response
      return response.data.symbols
        .filter((item: any) => item.symbol && item.symbol_info)
        .map((item: any) => ({
          symbol: item.symbol,
          name: item.symbol_info || item.symbol,
          score: calculateScore(query, item.symbol, item.symbol_info)
        }))
        .sort((a: any, b: any) => b.score - a.score)
        .slice(0, 10);
    }

    // Fallback to basic search if API fails
    return fallbackSearch(query);
  } catch (error) {
    console.error('NSE search error:', error);
    // Fallback to basic NIFTY 50 search
    return fallbackSearch(query);
  }
}

/**
 * Calculate relevance score
 */
function calculateScore(query: string, symbol: string, name: string): number {
  const q = query.toUpperCase();
  const s = symbol.toUpperCase();
  const n = name.toUpperCase();

  if (s === q) return 1.0;
  if (s.startsWith(q)) return 0.9;
  if (s.includes(q)) return 0.7;
  if (n.includes(q)) return 0.6;
  return 0.3;
}

/**
 * Fallback search using cached NIFTY 50
 */
function fallbackSearch(query: string): { symbol: string; name: string; score: number }[] {
  const normalized = query.toUpperCase().trim();

  // Basic NIFTY 50 list as fallback
  const nifty50 = [
    'TCS', 'RELIANCE', 'HDFCBANK', 'INFY', 'ICICIBANK',
    'HINDUNILVR', 'ITC', 'SBIN', 'BHARTIARTL', 'BAJFINANCE',
    'KOTAKBANK', 'LT', 'HCLTECH', 'WIPRO', 'ASIANPAINT',
    'MARUTI', 'AXISBANK', 'TITAN', 'SUNPHARMA', 'ULTRACEMCO'
  ];

  return nifty50
    .filter(symbol => 
      symbol.includes(normalized) || 
      symbol.startsWith(normalized)
    )
    .map(symbol => ({
      symbol,
      name: symbol,
      score: symbol.startsWith(normalized) ? 0.9 : 0.7
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

/**
 * Get all NSE equity symbols (for autocomplete)
 */
export async function getAllEquitySymbols(): Promise<string[]> {
  try {
    const response = await axios.get('https://www.nseindia.com/api/equity-stockIndices?index=SECURITIES%20IN%20F%26O', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': 'https://www.nseindia.com/'
      }
    });

    if (response.data && response.data.data) {
      return response.data.data.map((item: any) => item.symbol);
    }

    return [];
  } catch (error) {
    console.error('Failed to fetch equity symbols:', error);
    return [];
  }
}

