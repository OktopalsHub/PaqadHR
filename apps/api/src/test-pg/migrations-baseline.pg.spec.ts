import { join } from 'node:path';

import { DataSource } from 'typeorm';

import { PG_TEST_URL } from './pg-harness';

const maybe = PG_TEST_URL ? describe : describe.skip;

maybe('migration baseline (real Postgres)', () => {
  jest.setTimeout(240_000);
  let ds: DataSource;

  beforeAll(async () => {
    jest.restoreAllMocks();
    process.env.DATABASE_URL = PG_TEST_URL;
    const { dataSourceOptions } = await import('../common/database/config/data-source');
    ds = new DataSource({ ...dataSourceOptions, migrationsRun: false });
    await ds.initialize();
    await ds.query('DROP SCHEMA public CASCADE');
    await ds.query('CREATE SCHEMA public');
    await ds.runMigrations({ transaction: 'all' });
  });
  afterAll(async () => {
    await ds?.destroy();
  });

  it('keeps the integrity guards on the money tables', async () => {
    const [{ checks }] = await ds.query(
      "SELECT count(*)::int AS checks FROM pg_constraint WHERE contype = 'c' AND connamespace = 'public'::regnamespace",
    );
    const [{ triggers }] = await ds.query(
      'SELECT count(*)::int AS triggers FROM pg_trigger WHERE NOT tgisinternal',
    );
    expect(checks).toBeGreaterThanOrEqual(45);
    expect(triggers).toBeGreaterThanOrEqual(9);
  });

  it('creates the unique indexes the application relies on', async () => {
    const rows: { indexname: string }[] = await ds.query(
      "SELECT indexname FROM pg_indexes WHERE schemaname = 'public'",
    );
    const names = rows.map((r) => r.indexname);
    for (const name of [
      'uq_shoutout_member_points_tenant_member',
      'uq_recruitment_offer_open_per_candidate',
      'uq_attendance_active_session',
      'uq_candidate_job_email',
    ]) {
      expect(names).toContain(name);
    }
  });

  it('has a migration for every entity table', async () => {
    const tables = new Set(
      (
        await ds.query(
          "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'",
        )
      ).map((r: { table_name: string }) => r.table_name),
    );
    const allEntities = new DataSource({
      type: 'postgres',
      url: PG_TEST_URL,
      entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
    });
    await allEntities.initialize();
    const missing = allEntities.entityMetadatas
      .map((meta) => meta.tableName)
      .filter((name) => !tables.has(name));
    await allEntities.destroy();
    expect(missing).toEqual([]);
  });

  it('rolls back an empty database completely, in reverse order', async () => {
    while ((await ds.query('SELECT 1 FROM migrations LIMIT 1')).length > 0) {
      await ds.undoLastMigration({ transaction: 'each' });
    }
    const [{ left }] = await ds.query(
      "SELECT count(*)::int AS left FROM information_schema.tables WHERE table_schema = 'public' AND table_name <> 'migrations'",
    );
    expect(left).toBe(0);
  });
});
