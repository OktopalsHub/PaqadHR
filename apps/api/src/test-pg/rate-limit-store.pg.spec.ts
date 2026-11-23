import { randomUUID } from 'node:crypto';

import type { DataSource } from 'typeorm';

import { RateLimitService } from '../common/services/rate-limit.service';
import { createMigratedDataSource, PG_TEST_URL } from './pg-harness';

const maybe = PG_TEST_URL ? describe : describe.skip;

maybe('shared rate limit store (real migrated Postgres)', () => {
  jest.setTimeout(240_000);
  let ds: DataSource;
  const originalEnv = process.env.NODE_ENV;
  const instances: RateLimitService[] = [];
  const instance = () => {
    const service = new RateLimitService(ds);
    instances.push(service);
    return service;
  };

  beforeAll(async () => {
    ds = await createMigratedDataSource();
    process.env.NODE_ENV = 'production';
  });
  afterAll(async () => {
    process.env.NODE_ENV = originalEnv;
    for (const service of instances) service.onModuleDestroy();
    await ds?.destroy();
  });

  const config = { rules: [{ windowMs: 60_000, maxRequests: 5 }] } as never;

  it('counts one budget across two service instances, as two replicas would', async () => {
    const [a, b] = [instance(), instance()];
    const key = `shared:${randomUUID()}`;
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, i) => (i % 2 ? a : b).checkRateLimit(key, config)),
    );
    expect(results.filter((r) => r.allowed)).toHaveLength(5);
    expect(results.filter((r) => !r.allowed)).toHaveLength(7);
  });

  it('starts a fresh window once the old one has expired', async () => {
    const service = instance();
    const key = `expiry:${randomUUID()}`;
    const short = { rules: [{ windowMs: 1_000, maxRequests: 1 }] } as never;
    expect((await service.checkRateLimit(key, short)).allowed).toBe(true);
    expect((await service.checkRateLimit(key, short)).allowed).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 1_200));
    expect((await service.checkRateLimit(key, short)).allowed).toBe(true);
  });

  it('locks an account after the failure limit and the lock is visible to another instance', async () => {
    const [a, b] = [instance(), instance()];
    const key = `login:${randomUUID()}`;
    for (let i = 0; i < 2; i++) await a.recordLockoutFailure(key, 3, 60_000);
    expect(b.isLocked(await b.getLockout(key))).toBe(false);
    await b.recordLockoutFailure(key, 3, 60_000);
    expect(a.isLocked(await a.getLockout(key))).toBe(true);
    await a.clearLockout(key);
    expect(b.isLocked(await b.getLockout(key))).toBe(false);
  });

  it('survives a restart: a new instance still sees the lockout', async () => {
    const key = `restart:${randomUUID()}`;
    await instance().recordLockoutFailure(key, 1, 60_000);
    expect(instance().isLocked(await instance().getLockout(key))).toBe(true);
  });

  it('keeps limiting from memory when the database is unreachable', async () => {
    const broken = new RateLimitService({
      query: () => Promise.reject(new Error('connection refused')),
    } as unknown as DataSource);
    instances.push(broken);
    const key = `down:${randomUUID()}`;
    const results: { allowed: boolean }[] = [];
    for (let i = 0; i < 7; i++) results.push(await broken.checkRateLimit(key, config));
    expect(results.filter((r) => r.allowed)).toHaveLength(5);
  });
});
