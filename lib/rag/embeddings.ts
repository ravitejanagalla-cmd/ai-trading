import axios from 'axios';

/**
 * Generate embeddings for text using LM Studio
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const provider = process.env.EMBEDDING_PROVIDER || 'lmstudio';
  
  if (provider === 'lmstudio') {
    return generateLMStudioEmbedding(text);
  }
  
  throw new Error(`Unsupported embedding provider: ${provider}`);
}

/**
 * Generate embedding using LM Studio's embedding model
 */
async function generateLMStudioEmbedding(text: string): Promise<number[]> {
  try {
    const baseUrl = process.env.LMSTUDIO_BASE_URL || 'http://localhost:1234/v1';
    const model = process.env.EMBEDDING_MODEL || 'nomic-embed-text';
    
    const response = await axios.post(`${baseUrl}/embeddings`, {
      model,
      input: text
    });
    
    return response.data.data[0].embedding;
  } catch (error) {
    console.error('LM Studio embedding error:', error);
    // Fallback: return zero vector
    const dimensions = parseInt(process.env.EMBEDDING_DIMENSIONS || '768');
    return new Array(dimensions).fill(0);
  }
}

/**
 * Generate embedding for market scenario
 */
export async function embedMarketScenario(data: {
  symbol: string;
  prices: { open: number; high: number; low: number; close: number; volume: number }[];
  indicators?: Record<string, number>;
}): Promise<number[]> {
  // Create textual representation of market state
  const latestPrice = data.prices[0];
  const priceChange = ((latestPrice.close - latestPrice.open) / latestPrice.open * 100).toFixed(2);
  
  // Calculate simple moving average
  const avgClose = data.prices.slice(0, 5).reduce((sum, p) => sum + p.close, 0) / 5;
  const priceVsMA = ((latestPrice.close - avgClose) / avgClose * 100).toFixed(2);
  
  // Calculate volatility (simple range)
  const volatility = data.prices.slice(0, 5).map(p => ((p.high - p.low) / p.low) * 100);
  const avgVolatility = (volatility.reduce((a, b) => a + b, 0) / volatility.length).toFixed(2);
  
  const text = `
Stock: ${data.symbol}
Price: ${latestPrice.close}, Change: ${priceChange}%
Volume: ${latestPrice.volume}
Price vs MA5: ${priceVsMA}%
5-day Volatility: ${avgVolatility}%
High: ${latestPrice.high}, Low: ${latestPrice.low}
`.trim();
  
  return await generateEmbedding(text);
}

/**
 * Generate embedding for trading decision
 */
export async function embedTradingDecision(data: {
  symbol: string;
  action: string;
  price: number;
  rationale: string;
  outcome?: number;
}): Promise<number[]> {
  const outcomeText = data.outcome !== undefined 
    ? ` Outcome: ${data.outcome > 0 ? '+' : ''}${data.outcome.toFixed(2)}%` 
    : '';
  
  const text = `
Trading Decision for ${data.symbol}
Action: ${data.action}
Price: ${data.price}
Rationale: ${data.rationale}${outcomeText}
`.trim();
  
  return await generateEmbedding(text);
}

/**
 * Generate embedding for chart pattern
 */
export async function embedPattern(data: {
  patternType: string;
  symbol: string;
  successRate?: number;
  avgGain?: number;
}): Promise<number[]> {
  const text = `
Pattern: ${data.patternType} on ${data.symbol}
Success Rate: ${data.successRate ? (data.successRate * 100).toFixed(0) + '%' : 'Unknown'}
Average Gain: ${data.avgGain ? data.avgGain.toFixed(2) + '%' : 'Unknown'}
`.trim();
  
  return await generateEmbedding(text);
}

/**
 * Batch generate embeddings
 */
export async function batchGenerateEmbeddings(texts: string[]): Promise<number[][]> {
  const embeddings: number[][] = [];
  
  // Process in batches to avoid overwhelming the service
  const batchSize = 5;
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchEmbeddings = await Promise.all(
      batch.map(text => generateEmbedding(text))
    );
    embeddings.push(...batchEmbeddings);
    
    // Small delay between batches
    if (i + batchSize < texts.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return embeddings;
}
