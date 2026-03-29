import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { sql } from 'drizzle-orm';
import { getPostgresClientOptions } from './postgres-client';

const connectionString = process.env.DATABASE_URL || 'postgres://mindstore:password@localhost:5432/mindstore';

const client = postgres(
  connectionString,
  getPostgresClientOptions(connectionString, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  }),
);
export const db = drizzle(client, { schema });

export { schema };
export type DB = typeof db;

/** Quick DB health check — returns true if connected */
export async function dbHealthy(): Promise<boolean> {
  try {
    await db.execute(sql`SELECT 1`);
    return true;
  } catch {
    return false;
  }
}
