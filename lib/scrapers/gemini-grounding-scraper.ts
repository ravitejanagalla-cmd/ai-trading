import { GoogleGenerativeAI } from '@google/generative-ai';
import { OHLCVData } from '../types';

export class GeminiGroundingScraperService {
  private genAI: GoogleGenerativeAI;
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY || '';
    
    if (!this.apiKey) {
      throw new Error('Gemini API key not found. Set GEMINI_API_KEY environment variable.');
    }

    this.genAI = new GoogleGenerativeAI(this.apiKey);
  }

  /**
   * Fetch historical stock data using Gemini grounding (web search)
   */
  async getHistoricalDataViaGrounding(
    symbol: string,
    fromDate: string,
    toDate: string
  ): Promise<OHLCVData[]> {
    try {
      const model = this.genAI.getGenerativeModel({ 
        model: 'gemini-2.5-flash' 
      });

      // Create a concise prompt to minimize token usage
      const prompt = `Extract ${symbol} OHLCV data (${fromDate} to ${toDate}).

Return JSON array only:
[{"date":"YYYY-MM-DD","open":0,"high":0,"low":0,"close":0,"volume":0}]

30-90 days. No explanations.`;

      console.log(`🔎 [Gemini Grounding] Searching for ${symbol} historical data from ${fromDate} to ${toDate}...`);

      const response = await model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 16000,
        }
      });

      const text = response.response.text();
      console.log(`📊 [Gemini Grounding] Received response for ${symbol}`);

      // Parse the JSON response
      const data = this.parseHistoricalDataResponse(text, symbol);
      
      if (data.length > 0) {
        console.log(`✅ [Gemini Grounding] Got ${data.length} records for ${symbol}`);
      } else {
        console.warn(`⚠️ [Gemini Grounding] No data extracted for ${symbol}`);
      }

      return data;
    } catch (error) {
      console.warn(`[Gemini Grounding] Error fetching data for ${symbol}:`, error);
      return [];
    }
  }

  /**
   * Fetch fundamental data using Gemini grounding
   */
  async getFundamentalDataViaGrounding(symbol: string): Promise<Record<string, any>> {
    try {
      const model = this.genAI.getGenerativeModel({ 
        model: 'gemini-2.0-flash-exp' 
      });

      const prompt = `Extract fundamentals for ${symbol}: name, sector, price, PE ratio, PB ratio, ROE, market cap, 52w high/low.

Return JSON only: {"symbol":"${symbol}","companyName":"","sector":"","price":0,"peRatio":0,"pbRatio":0,"roe":0,"marketCap":0,"weekHigh52":0,"weekLow52":0}`;

      console.log(`📈 [Gemini Grounding] Searching fundamental data for ${symbol}...`);

      const response = await model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 2000,
        }
      });

      const text = response.response.text();
      const data = this.parseFundamentalDataResponse(text, symbol);
      
      console.log(`✅ [Gemini Grounding] Got fundamental data for ${symbol}`);
      return data;
    } catch (error) {
      console.warn(`[Gemini Grounding] Error fetching fundamental data for ${symbol}:`, error);
      return { symbol };
    }
  }

  /**
   * Parse historical data from Gemini response
   */
  private parseHistoricalDataResponse(text: string, symbol: string): OHLCVData[] {
    try {
      // Remove markdown code blocks if present
      let jsonText = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      
      // Try to extract JSON array
      const jsonMatch = jsonText.match(/\[\s*\{[\s\S]*\}\s*\]/);
      
      if (!jsonMatch) {
        console.warn(`⚠️ No JSON array found in response for ${symbol}`);
        return [];
      }

      const parsed = JSON.parse(jsonMatch[0]) as any[];
      
      if (!Array.isArray(parsed)) {
        console.warn(`⚠️ Response is not an array for ${symbol}`);
        return [];
      }

      // Transform and validate data
      return parsed
        .map(item => {
          // Handle various date formats
          const date = this.normalizeDate(item.date);
          const close = parseFloat(String(item.close || item.Close || 0));
          
          if (!date || close <= 0) {
            return null;
          }

          return {
            symbol,
            date,
            open: parseFloat(String(item.open || item.Open || close)),
            high: parseFloat(String(item.high || item.High || close)),
            low: parseFloat(String(item.low || item.Low || close)),
            close,
            volume: parseInt(String(item.volume || item.Volume || 0))
          };
        })
        .filter((item): item is OHLCVData => item !== null)
        .slice(0, 90); // Limit to 90 days
    } catch (error) {
      console.error(`Error parsing historical data for ${symbol}:`, error);
      return [];
    }
  }

  /**
   * Parse fundamental data from Gemini response
   */
  private parseFundamentalDataResponse(text: string, symbol: string): Record<string, any> {
    try {
      // Remove markdown code blocks if present
      let jsonText = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      
      // Try to extract JSON object
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        return { symbol };
      }

      const parsed = JSON.parse(jsonMatch[0]) as Record<string, any>;
      
      // Normalize the data
      return {
        symbol,
        companyName: parsed.companyName || 'N/A',
        sector: parsed.sector || 'N/A',
        industry: parsed.industry || 'N/A',
        price: parseFloat(String(parsed.price || 0)),
        peRatio: parseFloat(String(parsed.peRatio || 0)),
        pbRatio: parseFloat(String(parsed.pbRatio || 0)),
        roe: parseFloat(String(parsed.roe || 0)),
        marketCap: parseFloat(String(parsed.marketCap || 0)),
        weekHigh52: parseFloat(String(parsed.weekHigh52 || 0)),
        weekLow52: parseFloat(String(parsed.weekLow52 || 0))
      };
    } catch (error) {
      console.error(`Error parsing fundamental data for ${symbol}:`, error);
      return { symbol };
    }
  }

  /**
   * Normalize date format to YYYY-MM-DD
   */
  private normalizeDate(dateStr: any): string | null {
    if (!dateStr) return null;

    dateStr = String(dateStr).trim();
    
    // Already in YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr;
    }

    // Try DD-MM-YYYY format
    const ddmmMatch = dateStr.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (ddmmMatch) {
      return `${ddmmMatch[3]}-${ddmmMatch[2]}-${ddmmMatch[1]}`;
    }

    // Try DD/MM/YYYY format
    const ddSlashMatch = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (ddSlashMatch) {
      return `${ddSlashMatch[3]}-${ddSlashMatch[2]}-${ddSlashMatch[1]}`;
    }

    // Try YYYY/MM/DD format
    const yyyySlashMatch = dateStr.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
    if (yyyySlashMatch) {
      return `${yyyySlashMatch[1]}-${yyyySlashMatch[2]}-${yyyySlashMatch[3]}`;
    }

    // Try Month DD, YYYY format
    const monthMatch = dateStr.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
    if (monthMatch) {
      const months: Record<string, string> = {
        january: '01', february: '02', march: '03', april: '04',
        may: '05', june: '06', july: '07', august: '08',
        september: '09', october: '10', november: '11', december: '12'
      };
      const monthNum = months[monthMatch[1].toLowerCase()];
      if (monthNum) {
        const day = String(monthMatch[2]).padStart(2, '0');
        return `${monthMatch[3]}-${monthNum}-${day}`;
      }
    }

    console.debug(`⚠️ Could not parse date: ${dateStr}`);
    return null;
  }
}

/**
 * Create and export singleton instance
 */
export function createGeminiGroundingScraperService(): GeminiGroundingScraperService {
  return new GeminiGroundingScraperService();
}
