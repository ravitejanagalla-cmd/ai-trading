import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/config/models/add
 * Add a new model to configuration
 */
export async function POST(request: NextRequest) {
  try {
    const { provider, modelId, name, description } = await request.json();

    if (!provider || !modelId) {
      return NextResponse.json(
        { success: false, error: 'provider and modelId required' },
        { status: 400 }
      );
    }

    const fs = await import('fs/promises');
    const path = await import('path');
    
    const configPath = path.join(process.cwd(), 'config', 'default.json');
    const configContent = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(configContent);

    // Check if model already exists
    const exists = config.models.some((m: any) => 
      m.basemodel === modelId && m.provider === provider
    );

    if (exists) {
      return NextResponse.json(
        { success: false, error: 'Model already exists' },
        { status: 400 }
      );
    }

    // Generate signature
    const signature = `${modelId.replace(/[^a-z0-9]/gi, '-')}-${provider}`.toLowerCase();

    // Add new model
    config.models.push({
      name: name || modelId,
      basemodel: modelId,
      provider,
      signature,
      enabled: true,
      description: description || `${provider} model`
    });

    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');

    return NextResponse.json({
      success: true,
      model: config.models[config.models.length - 1]
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to add model' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/config/models/remove
 * Remove a model from configuration
 */
export async function DELETE(request: NextRequest) {
  try {
    const { signature } = await request.json();

    if (!signature) {
      return NextResponse.json(
        { success: false, error: 'signature required' },
        { status: 400 }
      );
    }

    const fs = await import('fs/promises');
    const path = await import('path');
    
    const configPath = path.join(process.cwd(), 'config', 'default.json');
    const configContent = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(configContent);

    // Remove model
    config.models = config.models.filter((m: any) => m.signature !== signature);

    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');

    return NextResponse.json({
      success: true,
      message: 'Model removed'
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to remove model' },
      { status: 500 }
    );
  }
}
