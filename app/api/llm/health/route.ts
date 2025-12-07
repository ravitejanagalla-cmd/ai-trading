import { NextRequest, NextResponse } from 'next/server';
import { OllamaProvider } from '@/lib/llm/ollama-provider';
import { LMStudioProvider } from '@/lib/llm/lmstudio-provider';

/**
 * GET /api/llm/health
 * Check health status of all LLM providers
 */
export async function GET(request: NextRequest) {
  const results: any = {
    timestamp: new Date().toISOString(),
    providers: {}
  };

  // Check Ollama
  try {
    const ollama = new OllamaProvider();
    const isAvailable = await ollama.isAvailable();
    const models = isAvailable ? await ollama.listModels() : [];
    
    results.providers.ollama = {
      status: isAvailable ? 'online' : 'offline',
      url: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
      modelsAvailable: models.length,
      models: models
    };
  } catch (error) {
    results.providers.ollama = {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }

  // Check LM Studio
  try {
    const lmstudio = new LMStudioProvider();
    const isAvailable = await lmstudio.isAvailable();
    const models = isAvailable ? await lmstudio.listModels() : [];
    
    results.providers.lmstudio = {
      status: isAvailable ? 'online' : 'offline',
      url: process.env.LMSTUDIO_BASE_URL || 'http://localhost:1234/v1',
      modelsAvailable: models.length,
      models: models
    };
  } catch (error) {
    results.providers.lmstudio = {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }

  // Check Gemini
  try {
    const hasApiKey = !!process.env.GEMINI_API_KEY;
    results.providers.gemini = {
      status: hasApiKey ? 'configured' : 'not_configured',
      models: hasApiKey ? [
        'gemini-1.5-flash',
        'gemini-1.5-pro',
        'gemini-2.0-flash-exp'
      ] : [],
      note: hasApiKey ? 'API key configured' : 'API key required in .env.local'
    };
  } catch (error) {
    results.providers.gemini = {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }

  return NextResponse.json(results);
}
