import { DataSource } from 'typeorm';

import { dataSourceOptions } from './data-source';

const MIGRATION_LOCK_KEY = 'paqadhr:migrations';

/**
 * Container-start migration runner. Several replicas can boot at once during a deploy and
 * TypeORM does not lock `migrationsRun`, so the whole run is guarded by a Postgres session lock
 * held on its own connection: a second container waits here instead of applying the same DDL.
 */
async function main(): Promise<void> {
  const { Client } = await import('pg');
  const lock = new Client({ connectionString: process.env.DATABASE_URL });
  await lock.connect();
  await lock.query('SELECT pg_advisory_lock(hashtext($1))', [MIGRATION_LOCK_KEY]);

  const dataSource = new DataSource({ ...dataSourceOptions, migrationsRun: false });
  try {
    await dataSource.initialize();
    await dataSource.runMigrations({ transaction: 'all' });
  } finally {
    await dataSource.destroy().catch(() => undefined);
    await lock
      .query('SELECT pg_advisory_unlock(hashtext($1))', [MIGRATION_LOCK_KEY])
      .catch(() => undefined);
    await lock.end().catch(() => undefined);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error('Migrations failed', error);
    process.exit(1);
  });
