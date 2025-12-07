import axios from 'axios';
import { AgentInput, TradingDecision, LLMResponse } from '../types';

export class OllamaProvider {
  private baseUrl: string;
  private model: string;

  constructor(model: string = 'llama3.1:70b', baseUrl?: string) {
    this.baseUrl = baseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    this.model = model;
  }

  /**
   * Generate trading decision using local Ollama model
   */
  async generateTradingDecision(
    systemPrompt: string,
    agentInput: AgentInput
  ): Promise<TradingDecision> {
    try {
      const messages = [
        { role: 'system', content: systemPrompt },
        { 
          role: 'user', 
          content: `Here is the current market state and your task:\n\n${JSON.stringify(agentInput, null, 2)}\n\nProvide your trading decision as a valid JSON object.`
        }
      ];

      const response = await axios.post(`${this.baseUrl}/api/chat`, {
        model: this.model,
        messages,
        stream: false,
        format: 'json', // Request JSON output
        options: {
          temperature: 0.7,
          top_p: 0.95,
          top_k: 40,
        }
      });

      const content = response.data.message.content;
      const decision = JSON.parse(content) as TradingDecision;

      return decision;
    } catch (error) {
      console.error('Error generating trading decision with Ollama:', error);
      throw error;
    }
  }

  /**
   * General text generation
   */
  async generate(prompt: string, systemPrompt?: string): Promise<LLMResponse> {
    try {
      const messages: any[] = [];
      
      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
      }
      
      messages.push({ role: 'user', content: prompt });

      const response = await axios.post(`${this.baseUrl}/api/chat`, {
        model: this.model,
        messages,
        stream: false,
      });

      return {
        content: response.data.message.content,
        usage: {
          promptTokens: response.data.prompt_eval_count || 0,
          completionTokens: response.data.eval_count || 0,
          totalTokens: (response.data.prompt_eval_count || 0) + (response.data.eval_count || 0),
        }
      };
    } catch (error) {
      console.error('Error generating with Ollama:', error);
      throw error;
    }
  }

  /**
   * Generate with JSON mode enabled
   */
  async generateJSON(prompt: string, systemPrompt?: string): Promise<any> {
    try {
      const messages: any[] = [];
      
      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
      }
      
      messages.push({ role: 'user', content: prompt });

      const response = await axios.post(`${this.baseUrl}/api/chat`, {
        model: this.model,
        messages,
        stream: false,
        format: 'json',
      });

      return JSON.parse(response.data.message.content);
    } catch (error) {
      console.error('Error generating JSON with Ollama:', error);
      throw error;
    }
  }

  /**
   * Check if Ollama server is running
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`, {
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
      const response = await axios.get(`${this.baseUrl}/api/tags`);
      return response.data.models.map((m: any) => m.name);
    } catch (error) {
      console.error('Error listing Ollama models:', error);
      return [];
    }
  }
}
