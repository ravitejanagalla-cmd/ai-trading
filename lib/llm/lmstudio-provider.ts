import axios from 'axios';
import { AgentInput, TradingDecision, LLMResponse } from '../types';

export class LMStudioProvider {
  private baseUrl: string;
  private model: string;

  constructor(model: string = 'local-model', baseUrl?: string) {
    this.baseUrl = baseUrl || process.env.LMSTUDIO_BASE_URL || 'http://localhost:1234/v1';
    this.model = model;
  }

  /**
   * Generate trading decision using LM Studio (OpenAI-compatible API)
   */
  async generateTradingDecision(
    systemPrompt: string,
    agentInput: AgentInput
  ): Promise<TradingDecision> {
    try {
      const userMessage = `Here is the current market state and your task:\n\n${JSON.stringify(agentInput, null, 2)}\n\nProvide your trading decision as a valid JSON object following the exact schema defined in the instructions.`;

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ];

      // Try with response_format first (OpenAI compatible)
      let response;
      try {
        response = await axios.post(`${this.baseUrl}/chat/completions`, {
          model: this.model,
          messages,
          temperature: 0.7,
          max_tokens: 2000,
          response_format: { type: 'json_object' }
        });
      } catch (formatError) {
        // If response_format isn't supported, try without it
        console.log('Trying without response_format...');
        response = await axios.post(`${this.baseUrl}/chat/completions`, {
          model: this.model,
          messages,
          temperature: 0.7,
          max_tokens: 2000
        });
      }

      const content = response.data.choices[0].message.content;

      // Parse trading decision from response
      const decision = this.parseDecisionFromText(content);
      
      return decision;
    } catch (error) {
      console.error('LM Studio error:', error);
      
      // Return empty decision on error
      return {
        timestamp: agentInput.timestamp,
        orders: [],
        portfolioUpdates: undefined,
        diagnostics: {
          summary: `LM Studio error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          keySignals: [],
          confidenceOverall: 0,
          expectedPortfolioChange: { cashDelta: 0, positionChanges: {} },
          ruleViolations: []
        }
      };
    }
  }

  /**
   * Helper to parse TradingDecision from text, handling cases where the model might wrap JSON in markdown.
   */
  private parseDecisionFromText(text: string): TradingDecision {
    try {
      // Attempt direct parse
      return JSON.parse(text) as TradingDecision;
    } catch (e) {
      // If direct parse fails, try to extract JSON from within markdown code blocks
      const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch && jsonMatch[1]) {
        try {
          return JSON.parse(jsonMatch[1]) as TradingDecision;
        } catch (innerError) {
          console.warn('Could not parse JSON from ```json``` block:', innerError);
        }
      }

      // Fallback: try to find any JSON object
      const genericJsonMatch = text.match(/\{[\s\S]*\}/);
      if (genericJsonMatch && genericJsonMatch[0]) {
        try {
          return JSON.parse(genericJsonMatch[0]) as TradingDecision;
        } catch (innerError) {
          console.warn('Could not parse generic JSON object from text:', innerError);
        }
      }
      
      throw new Error('Failed to parse TradingDecision from LLM response.');
    }
  }

  /**
   * General text generation using OpenAI-compatible API
   */
  async generate(prompt: string, systemPrompt?: string): Promise<LLMResponse> {
    try {
      const messages: any[] = [];
      
      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
      }
      
      messages.push({ role: 'user', content: prompt });

      const response = await axios.post(`${this.baseUrl}/chat/completions`, {
        model: this.model,
        messages,
        temperature: 0.7,
        max_tokens: 2048,
      });

      const choice = response.data.choices[0];

      return {
        content: choice.message.content,
        usage: {
          promptTokens: response.data.usage?.prompt_tokens || 0,
          completionTokens: response.data.usage?.completion_tokens || 0,
          totalTokens: response.data.usage?.total_tokens || 0,
        }
      };
    } catch (error) {
      console.error('Error generating with LM Studio:', error);
      throw error;
    }
  }

  /**
   * Generate with function calling support
   */
  async generateWithFunctions(
    prompt: string,
    functions: any[],
    systemPrompt?: string
  ): Promise<LLMResponse> {
    try {
      const messages: any[] = [];
      
      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
      }
      
      messages.push({ role: 'user', content: prompt });

      const response = await axios.post(`${this.baseUrl}/chat/completions`, {
        model: this.model,
        messages,
        functions,
        temperature: 0.7,
        max_tokens: 2048,
      });

      const choice = response.data.choices[0];

      return {
        content: choice.message.content || '',
        usage: {
          promptTokens: response.data.usage?.prompt_tokens || 0,
          completionTokens: response.data.usage?.completion_tokens || 0,
          totalTokens: response.data.usage?.total_tokens || 0,
        }
      };
    } catch (error) {
      console.error('Error generating with functions:', error);
      throw error;
    }
  }

  /**
   * Check if LM Studio server is running
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/models`, {
        timeout: 5000
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  /**
   * List available models
   */
  async listModels(): Promise<string[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/models`);
      return response.data.data.map((m: any) => m.id);
    } catch (error) {
      console.error('Error listing LM Studio models:', error);
      return [];
    }
  }

  /**
   * Generate streaming response
   */
  async *generateStream(prompt: string, systemPrompt?: string): AsyncGenerator<string> {
    try {
      const messages: any[] = [];
      
      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
      }
      
      messages.push({ role: 'user', content: prompt });

      const response = await axios.post(`${this.baseUrl}/chat/completions`, {
        model: this.model,
        messages,
        temperature: 0.7,
        max_tokens: 2048,
        stream: true,
      }, {
        responseType: 'stream'
      });

      for await (const chunk of response.data) {
        const lines = chunk.toString().split('\n').filter((line: string) => line.trim());
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') return;
            
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content;
              if (content) yield content;
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (error) {
      console.error('Error in streaming generation:', error);
      throw error;
    }
  }
}
