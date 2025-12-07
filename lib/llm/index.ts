import { GeminiProvider } from './gemini-provider';
import { OllamaProvider } from './ollama-provider';
import { LMStudioProvider } from './lmstudio-provider';
import { LLMProvider, ModelConfig, AgentInput, TradingDecision, LLMResponse } from '../types';

/**
 * Unified LLM provider interface
 */
export interface ILLMProvider {
  generateTradingDecision(systemPrompt: string, agentInput: AgentInput): Promise<TradingDecision>;
  generate(prompt: string, systemPrompt?: string): Promise<LLMResponse>;
}

/**
 * Factory function to create the appropriate LLM provider
 */
export function createLLMProvider(config: ModelConfig): ILLMProvider {
  switch (config.provider) {
    case 'gemini':
      return new GeminiProvider(process.env.GEMINI_API_KEY, config.basemodel);
    
    case 'ollama':
      return new OllamaProvider(config.basemodel, process.env.OLLAMA_BASE_URL);
    
    case 'lmstudio':
      return new LMStudioProvider(config.basemodel, process.env.LMSTUDIO_BASE_URL);
    
    default:
      throw new Error(`Unsupported LLM provider: ${config.provider}`);
  }
}

/**
 * Multi-provider manager for running multiple models concurrently
 */
export class MultiLLMManager {
  private providers: Map<string, ILLMProvider> = new Map();

  constructor(models: ModelConfig[]) {
    for (const model of models) {
      if (model.enabled) {
        try {
          const provider = createLLMProvider(model);
          this.providers.set(model.signature, provider);
          console.log(`✓ Initialized ${model.provider} provider: ${model.name}`);
        } catch (error) {
          console.error(`✗ Failed to initialize ${model.name}:`, error);
        }
      }
    }
  }

  /**
   * Get a specific provider by signature
   */
  getProvider(signature: string): ILLMProvider | undefined {
    return this.providers.get(signature);
  }

  /**
   * Get all enabled providers
   */
  getAllProviders(): Map<string, ILLMProvider> {
    return this.providers;
  }

  /**
   * Generate trading decisions from all providers concurrently
   */
  async generateAllDecisions(
    systemPrompt: string,
    agentInput: AgentInput
  ): Promise<Map<string, TradingDecision>> {
    const decisions = new Map<string, TradingDecision>();

    const promises = Array.from(this.providers.entries()).map(async ([signature, provider]) => {
      try {
        console.log(`Generating decision for ${signature}...`);
        const decision = await provider.generateTradingDecision(systemPrompt, agentInput);
        decisions.set(signature, decision);
        console.log(`✓ ${signature} completed`);
      } catch (error) {
        console.error(`✗ ${signature} failed:`, error);
      }
    });

    await Promise.all(promises);

    return decisions;
  }

  /**
   * Check availability of all providers
   */
  async checkAvailability(): Promise<Record<string, boolean>> {
    const availability: Record<string, boolean> = {};

    for (const [signature, provider] of this.providers.entries()) {
      try {
        // Try a simple generation as health check
        if ('isAvailable' in provider && typeof (provider as any).isAvailable === 'function') {
          availability[signature] = await (provider as any).isAvailable();
        } else {
          availability[signature] = true; // Assume available
        }
      } catch {
        availability[signature] = false;
      }
    }

    return availability;
  }
}

// Export individual providers
export { GeminiProvider, OllamaProvider, LMStudioProvider };
