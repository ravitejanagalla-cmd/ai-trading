/**
 * Stock image/logo utilities
 * Sources: Local logos directory, TradingView fetch on-demand, or generated fallback
 */

const STOCK_IMAGE_CACHE: Record<string, string> = {};
const LOGO_FETCH_QUEUE: Set<string> = new Set();

/**
 * Get stock logo URL
 * Priority:
 * 1. Local logo file (/public/logos/stocks/)
 * 2. Try to fetch from TradingView if available
 * 3. Generated placeholder
 */
export async function getStockImage(symbol: string): Promise<string> {
  const cacheKey = symbol.toUpperCase();
  
  // Return cached image if available
  if (STOCK_IMAGE_CACHE[cacheKey]) {
    return STOCK_IMAGE_CACHE[cacheKey];
  }

  // Try local logo first (SVG or PNG)
  let localLogoUrl = `/logos/stocks/${symbol.toLowerCase()}.svg`;
  STOCK_IMAGE_CACHE[cacheKey] = localLogoUrl;
  
  // Attempt to fetch from TradingView if not in queue and not recently attempted
  if (!LOGO_FETCH_QUEUE.has(cacheKey)) {
    LOGO_FETCH_QUEUE.add(cacheKey);
    // Non-blocking background fetch
    fetchLogoFromTradingView(symbol).catch(err => {
      console.debug(`Failed to fetch logo for ${symbol}:`, err.message);
    });
  }
  
  // Placeholder will be used as fallback if 404
  return localLogoUrl;
}

/**
 * Attempt to fetch logo from TradingView and save locally
 * This runs in the background and doesn't block the API
 */
async function fetchLogoFromTradingView(symbol: string): Promise<void> {
  // Only run on server side (Node.js), not in browser
  if (typeof window !== 'undefined') {
    return;
  }

  try {
    const response = await fetch(
      `/api/logos/fetch?symbol=${encodeURIComponent(symbol)}`,
      { method: 'POST' }
    );
    
    if (response.ok) {
      console.log(`📥 Logo fetched and cached for ${symbol}`);
    }
  } catch (err) {
    // Silently fail - placeholder will be used
  }
}

/**
 * Generate a placeholder image URL with stock initials
 */
export function getPlaceholderImage(symbol: string): string {
  const initials = symbol.substring(0, 2).toUpperCase();
  const colors = [
    'FF6B6B', // Red
    '4ECDC4', // Teal
    '45B7D1', // Blue
    'FFA07A', // Light Salmon
    '98D8C8', // Mint
    'F7DC6F', // Yellow
    'BB8FCE', // Purple
    '85C1E2', // Light Blue
  ];
  
  // Deterministic color based on symbol
  const colorIndex = symbol.charCodeAt(0) % colors.length;
  const bgColor = colors[colorIndex];
  
  // Create a simple SVG placeholder
  const svg = `
    <svg width="48" height="48" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" fill="#${bgColor}" rx="8"/>
      <text x="24" y="28" font-size="20" font-weight="bold" text-anchor="middle" fill="white" font-family="Arial">
        ${initials}
      </text>
    </svg>
  `.trim();
  
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

/**
 * Get stock image (client-safe version)
 * Use this in client components
 */
export function getStockImageSync(symbol: string): string {
  return getPlaceholderImage(symbol);
}

/**
 * Batch fetch stock images
 */
export async function batchGetStockImages(symbols: string[]): Promise<Record<string, string>> {
  const results: Record<string, string> = {};
  
  await Promise.all(
    symbols.map(async (symbol) => {
      try {
        results[symbol] = await getStockImage(symbol);
      } catch (err) {
        results[symbol] = getPlaceholderImage(symbol);
      }
    })
  );
  
  return results;
}
