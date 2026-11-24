import { join } from 'node:path';

import { DataSource } from 'typeorm';

export const PG_TEST_URL = process.env.PG_TEST_URL;

/** Entities whose declared indexes point at columns the entity itself lacks (schema drift). */
const DRIFTED_INDEX_TABLES = new Set(['plan_prices']);

export async function createPgDataSource(): Promise<DataSource> {
  // test/jest-setup.ts stubs initialize/destroy so unit tests never open a connection.
  jest.restoreAllMocks();
  const dataSource = new DataSource({
    type: 'postgres',
    url: PG_TEST_URL,
    entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
    synchronize: false,
    extra: { max: 30 },
  });
  await dataSource.initialize();
  for (const meta of dataSource.entityMetadatas) {
    if (DRIFTED_INDEX_TABLES.has(meta.tableName)) meta.indices = [];
  }
  await dataSource.synchronize(true);
  await relaxConstraints(dataSource);
  return dataSource;
}

/** Concurrency tests seed only the columns they exercise, so drop FKs and NOT NULLs. */
async function relaxConstraints(dataSource: DataSource): Promise<void> {
  await dataSource.query(`
    DO $$
    DECLARE r record;
    BEGIN
      FOR r IN SELECT conrelid::regclass AS tbl, conname FROM pg_constraint WHERE contype = 'f' LOOP
        EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
      END LOOP;
      FOR r IN
        SELECT c.table_name, c.column_name FROM information_schema.columns c
        JOIN information_schema.tables t ON t.table_name = c.table_name AND t.table_schema = c.table_schema
        WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE' AND c.is_nullable = 'NO'
          AND c.column_default IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM information_schema.key_column_usage k
            WHERE k.table_schema = c.table_schema AND k.table_name = c.table_name AND k.column_name = c.column_name)
      LOOP
        EXECUTE format('ALTER TABLE %I ALTER COLUMN %I DROP NOT NULL', r.table_name, r.column_name);
      END LOOP;
    END $$;
  `);
}

/** Empty database built by the real migrations, so triggers and CHECKs are in place. */
export async function createMigratedDataSource(): Promise<DataSource> {
  jest.restoreAllMocks();
  process.env.DATABASE_URL = PG_TEST_URL;
  const { dataSourceOptions } = await import('../common/database/config/data-source');
  const dataSource = new DataSource({ ...dataSourceOptions, migrationsRun: false });
  await dataSource.initialize();
  await dataSource.query('DROP SCHEMA public CASCADE');
  await dataSource.query('CREATE SCHEMA public');
  await dataSource.runMigrations({ transaction: 'all' });
  return dataSource;
}
