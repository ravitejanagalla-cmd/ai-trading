import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

/**
 * GET /api/test/verify
 * Verify tables exist and show sample data
 */
export async function GET(request: NextRequest) {
  const connectionString = process.env.POSTGRES_URL  
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const client = await pool.connect();
    
    try {
      // Check tables
      const tables = await client.query(`
        SELECT 
          schemaname,
          tablename,
          tableowner
        FROM pg_catalog.pg_tables 
        WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
        ORDER BY schemaname, tablename;
      `);

      // Count rows in each table
      const tableCounts: Record<string, number> = {};
      for (const table of tables.rows) {
        try {
          const countResult = await client.query(`SELECT COUNT(*) FROM ${table.schemaname}.${table.tablename}`);
          tableCounts[`${table.schemaname}.${table.tablename}`] = parseInt(countResult.rows[0].count);
        } catch (e) {
          tableCounts[`${table.schemaname}.${table.tablename}`] = -1;
        }
      }

      // Get database name
      const dbResult = await client.query('SELECT current_database()');
      
      return NextResponse.json({
        success: true,
        database: dbResult.rows[0].current_database,
        tablesFound: tables.rows.length,
        tables: tables.rows,
        rowCounts: tableCounts,
        connectionInfo: {
          host: connectionString.match(/@([^/]+)/)?.[1],
          database: connectionString.match(/\/([^?]+)/)?.[1]
        }
      });
    } finally {
      client.release();
      await pool.end();
    }
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        connectionString: connectionString.substring(0, 60) + '...'
      },
      { status: 500 }
    );
  }
}
