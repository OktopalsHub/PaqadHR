import { RateLimitService } from './rate-limit.service';

describe('RateLimitService.checkRateLimit', () => {
  let service: RateLimitService;

  beforeEach(() => {
    service = new RateLimitService();
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it('allows requests up to the limit and blocks the one after it', async () => {
    const config = { rules: [{ windowMs: 60_000, maxRequests: 2 }] };

    const first = await service.checkRateLimit('single-rule', config);
    const second = await service.checkRateLimit('single-rule', config);
    const third = await service.checkRateLimit('single-rule', config);

    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(1);
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(0);
    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
    expect(third.retryAfter).toBeGreaterThan(0);
  });

  it('enforces every rule of a multi-rule config', async () => {
    const config = {
      rules: [
        { windowMs: 60_000, maxRequests: 5 },
        { windowMs: 60_000, maxRequests: 2 },
      ],
    };

    await service.checkRateLimit('multi-rule', config);
    await service.checkRateLimit('multi-rule', config);
    const third = await service.checkRateLimit('multi-rule', config);

    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
  });

  it('keeps buckets of different keys independent', async () => {
    const config = { rules: [{ windowMs: 60_000, maxRequests: 1 }] };

    const first = await service.checkRateLimit('key-a', config);
    const other = await service.checkRateLimit('key-b', config);
    const repeated = await service.checkRateLimit('key-a', config);

    expect(first.allowed).toBe(true);
    expect(other.allowed).toBe(true);
    expect(repeated.allowed).toBe(false);
  });
});
