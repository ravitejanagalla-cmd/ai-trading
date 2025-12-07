import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

/**
 * GET /api/debug/logs
 * Get recent debug logs
 */
export async function GET(request: NextRequest) {
  try {
    const logsPath = path.join(process.cwd(), 'data', 'debug-logs.json');
    
    try {
      const content = await fs.readFile(logsPath, 'utf-8');
      const logs = JSON.parse(content);
      
      return NextResponse.json({
        success: true,
        logs: logs.slice(-50) // Last 50 entries
      });
    } catch {
      return NextResponse.json({
        success: true,
        logs: []
      });
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to read logs' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/debug/logs
 * Add a debug log entry
 */
export async function POST(request: NextRequest) {
  try {
    const logEntry = await request.json();
    
    const dataDir = path.join(process.cwd(), 'data');
    await fs.mkdir(dataDir, { recursive: true });
    
    const logsPath = path.join(dataDir, 'debug-logs.json');
    
    let logs = [];
    try {
      const content = await fs.readFile(logsPath, 'utf-8');
      logs = JSON.parse(content);
    } catch {
      logs = [];
    }
    
    logs.push({
      ...logEntry,
      timestamp: new Date().toISOString()
    });
    
    // Keep only last 100 entries
    if (logs.length > 100) {
      logs = logs.slice(-100);
    }
    
    await fs.writeFile(logsPath, JSON.stringify(logs, null, 2));
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to write log' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/debug/logs
 * Clear all debug logs
 */
export async function DELETE(request: NextRequest) {
  try {
    const logsPath = path.join(process.cwd(), 'data', 'debug-logs.json');
    await fs.writeFile(logsPath, JSON.stringify([], null, 2));
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to clear logs' },
      { status: 500 }
    );
  }
}
