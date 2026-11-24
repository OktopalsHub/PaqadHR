import * as dotenv from 'dotenv';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

import * as Entities from '../entities';
import * as Migrations from '../migrations';

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

// Without these a burst queues behind the pool forever and one slow query holds a connection.
const DB_POOL_MAX = positiveInt(process.env.DB_POOL_MAX, 10);
const DB_ACQUIRE_TIMEOUT_MS = positiveInt(process.env.DB_ACQUIRE_TIMEOUT_MS, 5000);
const DB_STATEMENT_TIMEOUT_MS = positiveInt(process.env.DB_STATEMENT_TIMEOUT_MS, 30000);

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not defined, please check your environment variables.');
}

const AppDataSource = {
  type: 'postgres',
  url: databaseUrl,
  synchronize: false,
  poolSize: DB_POOL_MAX,
  extra: {
    connectionTimeoutMillis: DB_ACQUIRE_TIMEOUT_MS,
    statement_timeout: DB_STATEMENT_TIMEOUT_MS,
  },
  autoLoadEntities: true,
  entities: Object.values(Entities).filter((entity) => typeof entity === 'function'),
  migrations: Object.values(Migrations).filter((migration) => typeof migration === 'function'),
  logging: process.env.NODE_ENV === 'production' ? false : ['error', 'warn'],
  migrationsRun: true,
  migrationsTransactionMode: 'all',
  namingStrategy: new SnakeNamingStrategy(),
} as DataSourceOptions;

export const dataSourceOptions = AppDataSource;
export default new DataSource(AppDataSource);

export async function waitForDatabase(maxRetries = 30, retryIntervalMs = 1000): Promise<void> {
  const { Client } = await import('pg');

  for (let i = 1; i <= maxRetries; i++) {
    try {
      const client = new Client({ connectionString: databaseUrl });
      await client.connect();
      await client.end();
      return;
    } catch (error: unknown) {
      if (i === maxRetries) throw error;
      await new Promise((resolve) => setTimeout(resolve, retryIntervalMs));
    }
  }
}
