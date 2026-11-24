import { randomUUID } from 'node:crypto';

import type { DataSource } from 'typeorm';

import { PostgresRateLimitStore } from '../common/config/postgres-rate-limit-store';
import { createMigratedDataSource, PG_TEST_URL } from './pg-harness';

const maybe = PG_TEST_URL ? describe : describe.skip;

maybe('express rate limit store (real migrated Postgres)', () => {
  jest.setTimeout(240_000);
  let ds: DataSource;

  beforeAll(async () => {
    ds = await createMigratedDataSource();
  });
  afterAll(async () => {
    await ds?.destroy();
  });

  const store = (scope = 'auth') => {
    const s = new PostgresRateLimitStore(ds, scope);
    s.init({ windowMs: 60_000 } as never);
    return s;
  };

  it('shares one count between two store instances, as two replicas would', async () => {
    const key = randomUUID();
    const [a, b] = [store(), store()];
    const hits = await Promise.all(
      Array.from({ length: 10 }, (_, i) => (i % 2 ? a : b).increment(key)),
    );
    expect(Math.max(...hits.map((h) => h.totalHits))).toBe(10);
    expect(new Set(hits.map((h) => h.totalHits)).size).toBe(10);
  });

  it('keeps separate limiters apart and supports decrement and reset', async () => {
    const key = randomUUID();
    await store('auth').increment(key);
    expect((await store('contact').increment(key)).totalHits).toBe(1);
    await store('auth').decrement(key);
    expect((await store('auth').increment(key)).totalHits).toBe(1);
    await store('auth').resetKey(key);
    expect((await store('auth').increment(key)).totalHits).toBe(1);
  });

  it('falls back to memory when the database errors', async () => {
    const s = new PostgresRateLimitStore(
      { query: () => Promise.reject(new Error('down')) } as unknown as DataSource,
      'auth',
    );
    s.init({ windowMs: 60_000 } as never);
    expect((await s.increment('ip')).totalHits).toBe(1);
    expect((await s.increment('ip')).totalHits).toBe(2);
  });
});
