import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/config/models
 * Get current model configuration
 */
export async function GET(request: NextRequest) {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const configPath = path.join(process.cwd(), 'config', 'default.json');
    const configContent = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(configContent);

    return NextResponse.json({
      success: true,
      config
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to load config' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/config/models
 * Update model configuration
 */
export async function POST(request: NextRequest) {
  try {
    const newConfig = await request.json();
    
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const configPath = path.join(process.cwd(), 'config', 'default.json');
    await fs.writeFile(configPath, JSON.stringify(newConfig, null, 2), 'utf-8');

    return NextResponse.json({
      success: true,
      message: 'Configuration updated'
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to update config' },
      { status: 500 }
    );
  }
}
