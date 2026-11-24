import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { DataSource } from 'typeorm';

import type { RateLimitConfig } from '../interfaces/rate-limit-config.interface';
import type { RateLimitResult } from '../interfaces/rate-limit-result.interface';
import { InMemoryCacheService } from './in-memory-cache.service';

export interface LockoutState {
  count: number;
  lockedUntil?: number;
}

@Injectable()
export class RateLimitService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RateLimitService.name);
  private readonly inMemoryRateLimitCache: InMemoryCacheService;
  private readonly inMemoryLockoutCache: InMemoryCacheService;

  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(@Optional() private readonly dataSource?: DataSource) {
    this.inMemoryRateLimitCache = new InMemoryCacheService({
      maxEntries: 5000,
      maxMemoryBytes: 10 * 1024 * 1024,
      defaultTtlMs: 15 * 60 * 1000,
      namespace: 'rate-limit',
      enforcePiiTtlCap: false,
    });
    this.inMemoryLockoutCache = new InMemoryCacheService({
      maxEntries: 2000,
      maxMemoryBytes: 5 * 1024 * 1024,
      defaultTtlMs: 30 * 60 * 1000,
      namespace: 'lockout',
      enforcePiiTtlCap: false,
    });
    this.logger.log(
      this.useDatabase()
        ? 'Rate limits and lockouts stored in Postgres (shared across instances); in-memory fallback if the database is unreachable'
        : 'Rate limits using in-memory LRU cache — requires a single instance',
    );
  }

  onModuleInit(): void {
    if (!this.useDatabase()) return;
    this.cleanupTimer = setInterval(() => void this.deleteExpired(), 5 * 60 * 1000);
    this.cleanupTimer.unref();
  }

  private useDatabase(): boolean {
    return Boolean(this.dataSource) && process.env.NODE_ENV !== 'test';
  }

  private async deleteExpired(): Promise<void> {
    try {
      await this.dataSource?.query('DELETE FROM rate_limit_counters WHERE expires_at < now()');
      await this.dataSource?.query('DELETE FROM rate_limit_lockouts WHERE expires_at < now()');
    } catch (error) {
      this.logger.warn(`Rate limit cleanup failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  /** Runs against Postgres when available; any database error falls back to this process's memory. */
  private async withDatabase<T>(
    run: (dataSource: DataSource) => Promise<T>,
    fallback: () => T | Promise<T>,
  ): Promise<T> {
    if (!this.useDatabase() || !this.dataSource) return fallback();
    try {
      return await run(this.dataSource);
    } catch (error) {
      this.logger.error(
        `Rate limit store unavailable, using in-memory fallback: ${error instanceof Error ? error.message : error}`,
      );
      return fallback();
    }
  }

  private async incrementWindow(
    bucketKey: string,
    windowMs: number,
  ): Promise<{ count: number; resetTime: number }> {
    return this.withDatabase(
      async (dataSource) => {
        const [row] = await dataSource.query(
          `INSERT INTO rate_limit_counters (key, count, expires_at)
           VALUES ($1, 1, now() + ($2 || ' milliseconds')::interval)
           ON CONFLICT (key) DO UPDATE SET
             count = CASE WHEN rate_limit_counters.expires_at <= now() THEN 1 ELSE rate_limit_counters.count + 1 END,
             expires_at = CASE WHEN rate_limit_counters.expires_at <= now()
               THEN now() + ($2 || ' milliseconds')::interval ELSE rate_limit_counters.expires_at END
           RETURNING count, expires_at`,
          [`ratelimit:${bucketKey}`, String(windowMs)],
        );
        return { count: Number(row.count), resetTime: new Date(row.expires_at).getTime() };
      },
      () => this.inMemoryRateLimitCache.incrWithTtl(`ratelimit:${bucketKey}`, windowMs),
    );
  }

  onModuleDestroy(): void {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    this.inMemoryRateLimitCache.onModuleDestroy();
    this.inMemoryLockoutCache.onModuleDestroy();
  }

  getInMemoryStats(): {
    rateLimit: ReturnType<InMemoryCacheService['getStats']>;
    lockout: ReturnType<InMemoryCacheService['getStats']>;
  } {
    return {
      rateLimit: this.inMemoryRateLimitCache.getStats(),
      lockout: this.inMemoryLockoutCache.getStats(),
    };
  }

  /**
   * Fixed-window limiter. Every rule in `config.rules` is enforced — the request is
   * allowed only when all rules are under their limit. Each rule keeps its own bucket.
   */
  async checkRateLimit(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
    const now = Date.now();
    const rules = config.rules?.length ? config.rules : [{ windowMs: 60_000, maxRequests: 100 }];

    let remaining = Number.POSITIVE_INFINITY;
    let resetTime = now + (rules[0].windowMs || 60_000);
    let retryAfter: number | undefined;

    for (const [index, rule] of rules.entries()) {
      const windowMs = rule.windowMs || 60_000;
      const maxRequests = rule.maxRequests || 100;
      // Rule 0 keeps the original bucket key so existing limits are unaffected.
      const bucketKey = index === 0 ? key : `${key}:${index}`;
      const result = await this.incrementWindow(bucketKey, windowMs);
      const count = result.count;

      if (index === 0) resetTime = result.resetTime;
      remaining = Math.min(remaining, Math.max(0, maxRequests - count));

      if (count > maxRequests) {
        retryAfter = Math.max(retryAfter ?? 0, Math.ceil((result.resetTime - now) / 1000));
      }
    }

    if (retryAfter !== undefined) {
      return {
        allowed: false,
        remaining: 0,
        resetTime,
        retryAfter,
      };
    }

    return {
      allowed: true,
      remaining,
      resetTime,
    };
  }

  async clearRateLimit(key: string): Promise<void> {
    this.inMemoryRateLimitCache.delete(`ratelimit:${key}`);
    await this.withDatabase(
      (dataSource) => dataSource.query('DELETE FROM rate_limit_counters WHERE key = $1', [`ratelimit:${key}`]),
      () => undefined,
    );
  }

  async getLockout(key: string): Promise<LockoutState | undefined> {
    return this.withDatabase(
      async (dataSource) => {
        const [row] = await dataSource.query(
          'SELECT count, locked_until FROM rate_limit_lockouts WHERE key = $1 AND expires_at > now()',
          [`lockout:${key}`],
        );
        if (!row) return undefined;
        return {
          count: Number(row.count),
          ...(row.locked_until ? { lockedUntil: new Date(row.locked_until).getTime() } : {}),
        };
      },
      () => this.inMemoryLockoutCache.get<LockoutState>(`lockout:${key}`),
    );
  }

  async recordLockoutFailure(
    key: string,
    maxAttempts: number,
    lockDurationMs: number,
  ): Promise<LockoutState> {
    return this.withDatabase(
      async (dataSource) => {
        const [row] = await dataSource.query(
          `INSERT INTO rate_limit_lockouts (key, count, locked_until, expires_at)
           VALUES ($1, 1,
             CASE WHEN 1 >= $2 THEN now() + ($3 || ' milliseconds')::interval END,
             now() + ($3 || ' milliseconds')::interval)
           ON CONFLICT (key) DO UPDATE SET
             count = CASE WHEN rate_limit_lockouts.expires_at <= now() THEN 1 ELSE rate_limit_lockouts.count + 1 END,
             locked_until = CASE
               WHEN (CASE WHEN rate_limit_lockouts.expires_at <= now() THEN 1 ELSE rate_limit_lockouts.count + 1 END) >= $2
                 THEN now() + ($3 || ' milliseconds')::interval
               WHEN rate_limit_lockouts.expires_at <= now() THEN NULL
               ELSE rate_limit_lockouts.locked_until END,
             expires_at = now() + ($3 || ' milliseconds')::interval
           RETURNING count, locked_until`,
          [`lockout:${key}`, maxAttempts, String(lockDurationMs)],
        );
        return {
          count: Number(row.count),
          ...(row.locked_until ? { lockedUntil: new Date(row.locked_until).getTime() } : {}),
        };
      },
      () => this.recordLockoutFailureInMemory(key, maxAttempts, lockDurationMs),
    );
  }

  private recordLockoutFailureInMemory(
    key: string,
    maxAttempts: number,
    lockDurationMs: number,
  ): LockoutState {
    const entry = this.inMemoryLockoutCache.get<LockoutState>(`lockout:${key}`) ?? { count: 0 };
    entry.count += 1;
    if (entry.count >= maxAttempts) {
      entry.lockedUntil = Date.now() + lockDurationMs;
    }
    const ttlMs = entry.lockedUntil
      ? Math.max(entry.lockedUntil - Date.now(), lockDurationMs)
      : lockDurationMs;
    this.inMemoryLockoutCache.set(`lockout:${key}`, entry, ttlMs);
    return entry;
  }

  async clearLockout(key: string): Promise<void> {
    this.inMemoryLockoutCache.delete(`lockout:${key}`);
    await this.withDatabase(
      (dataSource) => dataSource.query('DELETE FROM rate_limit_lockouts WHERE key = $1', [`lockout:${key}`]),
      () => undefined,
    );
  }

  isLocked(state: LockoutState | undefined): boolean {
    return Boolean(state?.lockedUntil && state.lockedUntil > Date.now());
  }
}
