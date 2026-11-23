import { createPgDataSource, PG_TEST_URL } from './pg-harness';

const maybe = PG_TEST_URL ? describe : describe.skip;

maybe('pg harness', () => {
  jest.setTimeout(120_000);
  it('builds the schema from entities', async () => {
    const ds = await createPgDataSource();
    const [{ count }] = await ds.query(
      "SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema='public'",
    );
    await ds.destroy();
    expect(count).toBeGreaterThan(50);
  });
});
