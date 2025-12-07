import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/llm/discover
 * Discover all available models from all providers
 */
export async function GET(request: NextRequest) {
  const discovered: any = {
    timestamp: new Date().toISOString(),
    gemini: [],
    lmstudio: [],
    ollama: []
  };

  // Gemini models (predefined, API doesn't expose list)
  const hasGeminiKey = !!process.env.GEMINI_API_KEY;
  if (hasGeminiKey) {
    discovered.gemini = [
      {
        id: 'gemini-1.5-flash',
        name: 'Gemini 1.5 Flash',
        provider: 'gemini',
        description: 'Fast and efficient, higher rate limits'
      },
      {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        provider: 'gemini',
        description: 'Most capable model, best reasoning'
      },
      {
        id: 'gemini-2.0-flash-exp',
        name: 'Gemini 2.0 Flash (Experimental)',
        provider: 'gemini',
        description: 'Latest experimental version'
      }
    ];
  }

  // LM Studio models
  try {
    const lmstudioUrl = process.env.LMSTUDIO_BASE_URL || 'http://localhost:1234/v1';
    const response = await fetch(`${lmstudioUrl}/models`, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (response.ok) {
      const data = await response.json();
      discovered.lmstudio = data.data?.map((model: any) => ({
        id: model.id,
        name: model.id,
        provider: 'lmstudio',
        description: `Local model via LM Studio`,
        owned_by: model.owned_by
      })) || [];
    }
  } catch (error) {
    console.log('LM Studio not available');
  }

  // Ollama models
  try {
    const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    const response = await fetch(`${ollamaUrl}/api/tags`);
    
    if (response.ok) {
      const data = await response.json();
      discovered.ollama = data.models?.map((model: any) => ({
        id: model.name,
        name: model.name,
        provider: 'ollama',
        description: `Size: ${(model.size / 1024 / 1024 / 1024).toFixed(1)}GB`,
        size: model.size,
        modified_at: model.modified_at
      })) || [];
    }
  } catch (error) {
    console.log('Ollama not available');
  }

  return NextResponse.json(discovered);
}
