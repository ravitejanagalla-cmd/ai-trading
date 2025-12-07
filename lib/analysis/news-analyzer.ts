import axios from 'axios';

export interface NewsAnalysis {
  category: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  impact: 'high' | 'medium' | 'low';
  summary: string;
  keyPoints: string[];
}

/**
 * Analyze and categorize news using LLM
 */
export async function analyzeNewsWithLLM(newsItems: any[]): Promise<any[]> {
  if (!newsItems || newsItems.length === 0) return [];

  const baseUrl = process.env.LMSTUDIO_BASE_URL || 'http://localhost:1234/v1';
  const analyzed = [];

  for (const item of newsItems) {
    try {
      const prompt = `Analyze this stock market news and provide structured output:

Title: ${item.title}
Summary: ${item.summary || 'No summary available'}

Provide JSON response with:
{
  "category": "earnings|acquisition|regulatory|product|market|general",
  "sentiment": "bullish|bearish|neutral",
  "impact": "high|medium|low",
  "summary": "2-sentence concise summary",
  "keyPoints": ["point1", "point2", "point3"]
}

Respond ONLY with valid JSON.`;

      const response = await axios.post(`${baseUrl}/chat/completions`, {
        model: 'local-model',
        messages: [
          {
            role: 'system',
            content: 'You are a financial news analyst. Always respond with valid JSON only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 500
      }, {
        timeout: 15000
      });

      const content = response.data.choices[0].message.content;
      const analysis = parseAnalysis(content);

      analyzed.push({
        ...item,
        ...analysis
      });
    } catch (error) {
      console.error('LLM analysis failed for news:', error);
      // Fallback to simple keyword-based analysis
      analyzed.push({
        ...item,
        ...fallbackAnalysis(item)
      });
    }
  }

  return analyzed;
}

/**
 * Parse LLM analysis response
 */
function parseAnalysis(content: string): NewsAnalysis {
  try {
    // Try direct parse
    return JSON.parse(content);
  } catch {
    // Try extract from markdown
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]);
    }
    
    // Try find any JSON object
    const objectMatch = content.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      return JSON.parse(objectMatch[0]);
    }

    throw new Error('Could not parse analysis');
  }
}

/**
 * Fallback keyword-based analysis
 */
function fallbackAnalysis(item: any): NewsAnalysis {
  const text = `${item.title} ${item.summary}`.toLowerCase();
  
  // Category detection
  let category = 'general';
  if (text.includes('earning') || text.includes('profit') || text.includes('revenue')) category = 'earnings';
  else if (text.includes('acqui') || text.includes('merge')) category = 'acquisition';
  else if (text.includes('regul') || text.includes('sebi') || text.includes('comply')) category = 'regulatory';
  else if (text.includes('product') || text.includes('launch')) category = 'product';

  // Sentiment detection
  let sentiment: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  const bullishWords = ['surge', 'rally', 'gain', 'profit', 'growth', 'positive', 'beat', 'strong'];
  const bearishWords = ['fall', 'drop', 'loss', 'decline', 'weak', 'negative', 'miss'];
  
  const bullishCount = bullishWords.filter(w => text.includes(w)).length;
  const bearishCount = bearishWords.filter(w => text.includes(w)).length;
  
  if (bullishCount > bearishCount) sentiment = 'bullish';
  else if (bearishCount > bullishCount) sentiment = 'bearish';

  // Impact assessment
  let impact: 'high' | 'medium' | 'low' = 'medium';
  if (text.includes('major') || text.includes('significant') || text.includes('billion')) impact = 'high';
  else if (text.includes('minor') || text.includes('slight')) impact = 'low';

  return {
    category,
    sentiment,
    impact,
    summary: item.summary || item.title,
    keyPoints: [item.title]
  };
}
