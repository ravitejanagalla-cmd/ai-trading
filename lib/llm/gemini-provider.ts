import { GoogleGenerativeAI, GenerativeModel, Tool } from '@google/generative-ai';
import { AgentInput, TradingDecision, LLMResponse } from '../types';

export class GeminiProvider {
  private model: GenerativeModel;
  private apiKey: string;

  constructor(apiKey?: string, modelName: string = 'gemini-2.0-flash-exp') {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY || '';
    
    if (!this.apiKey) {
      throw new Error('Gemini API key not found. Set GEMINI_API_KEY environment variable.');
    }

    const genAI = new GoogleGenerativeAI(this.apiKey);
    
    this.model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 8192,
      },
    });
  }

  /**
   * Generate trading decision with Google Search grounding
   */
  async generateTradingDecision(
    systemPrompt: string,
    agentInput: AgentInput
  ): Promise<TradingDecision> {
    try {
      const prompt = `${systemPrompt}\n\nHere is the current market state and your task:\n\n${JSON.stringify(agentInput, null, 2)}\n\nProvide your trading decision as a valid JSON object following the exact schema defined in the instructions.`;

      // Enable Google Search grounding for additional market information
      const result = await this.model.generateContent(prompt);

      const response = result.response;
      const text = response.text();

      // Extract JSON from response
      const decision = this.parseDecisionFromText(text);
      
      return decision;
    } catch (error) {
      console.error('Error generating trading decision:', error);
      throw error;
    }
  }

  /**
   * Generate with structured output
   */
  async generateWithTools(
   prompt: string
  ): Promise<LLMResponse> {
    try {
      const result = await this.model.generateContent(prompt);

      const response = result.response;
      
      return {
        content: response.text(),
        usage: {
          promptTokens: 0, // Gemini doesn't provide token counts in all versions
          completionTokens: 0,
          totalTokens: 0,
        }
      };
    } catch (error) {
      console.error('Error generating with tools:', error);
      throw error;
    }
  }

  /**
   * Search for market information using Google Search grounding
   */
  async searchMarketInfo(query: string, maxResults: number = 5): Promise<any[]> {
    try {
      const prompt = `Search for: ${query}\n\nProvide the top ${maxResults} most relevant and recent results about Indian stock market.`;

      const result = await this.model.generateContent(prompt);

      const response = result.response;
      const text = response.text();

      // The grounding results are embedded in the response
      // Parse and structure them
      return this.parseSearchResults(text, maxResults);
    } catch (error) {
      console.error('Error searching market info:', error);
      return [];
    }
  }

  /**
   * Parse trading decision from LLM text response
   */
  private parseDecisionFromText(text: string): TradingDecision {
    // Try to extract JSON from markdown code blocks or raw text
    const jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || 
                     text.match(/(\{[\s\S]*\})/);
    
    if (!jsonMatch) {
      throw new Error('Failed to extract JSON from LLM response');
    }

    try {
      const decision = JSON.parse(jsonMatch[1]) as TradingDecision;
      
      // Validate required fields
      if (!decision.timestamp || !decision.orders || !decision.diagnostics) {
        throw new Error('Invalid trading decision structure');
      }

      return decision;
    } catch (error) {
      console.error('Error parsing decision JSON:', error);
      console.error('Raw text:', text);
      throw new Error('Failed to parse trading decision JSON');
    }
  }

  /**
   * Parse search results from grounded response
   */
  private parseSearchResults(text: string, maxResults: number): any[] {
    // This is a simplified parser - in practice, Gemini's grounding
    // provides structured data that we can extract
    const results: any[] = [];
    
    // Split by common delimiters and extract information
    const lines = text.split('\n');
    let currentResult: any = null;

    for (const line of lines) {
      if (line.trim().startsWith('http')) {
        if (currentResult) {
          results.push(currentResult);
        }
        currentResult = { url: line.trim(), title: '', summary: '' };
      } else if (currentResult && line.trim()) {
        if (!currentResult.title) {
          currentResult.title = line.trim();
        } else {
          currentResult.summary += line.trim() + ' ';
        }
      }
    }

    if (currentResult) {
      results.push(currentResult);
    }

    return results.slice(0, maxResults);
  }

  /**
   * General text generation
   */
  async generate(prompt: string): Promise<LLMResponse> {
    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response;

      return {
        content: response.text(),
        usage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        }
      };
    } catch (error) {
      console.error('Error generating content:', error);
      throw error;
    }
  }
}
