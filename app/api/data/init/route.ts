import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase, initializeQdrant } from '@/lib/data/db';

/**
 * POST /api/data/init
 * Initialize PostgreSQL and Qdrant databases
 */
export async function POST(request: NextRequest) {
  try {
    // Initialize PostgreSQL schemas
    await initializeDatabase();
    
    // Initialize Qdrant collections
    await initializeQdrant();
    
    return NextResponse.json({
      success: true,
      message: 'Databases initialized successfully'
    });
  } catch (error) {
    console.error('Database initialization error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to initialize databases'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/data/init
 * Check database status
 */
export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({
      success: true,
      status: {
        postgres: process.env.POSTGRES_URL ? 'configured' : 'not configured',
        qdrant: process.env.QDRANT_URL || 'http://localhost:6333'
      }
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to check status' },
      { status: 500 }
    );
  }
}
