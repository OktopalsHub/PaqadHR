import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type { RateLimitConfig } from '../interfaces/rate-limit-config.interface';
import type { RateLimitResult } from '../interfaces/rate-limit-result.interface';
import { InMemoryCacheService } from './in-memory-cache.service';

export interface LockoutState {
  count: number;
  lockedUntil?: number;
}

@Injectable()
export class RateLimitService implements OnModuleDestroy {
  private readonly logger = new Logger(RateLimitService.name);
  private readonly inMemoryRateLimitCache: InMemoryCacheService;
  private readonly inMemoryLockoutCache: InMemoryCacheService;

  constructor() {
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
      'Rate limits using in-memory LRU cache — requires single PM2 worker (-i 1) without Redis',
    );
  }

  onModuleDestroy(): void {
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
      const result = this.inMemoryRateLimitCache.incrWithTtl(`ratelimit:${bucketKey}`, windowMs);
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
  }

  async getLockout(key: string): Promise<LockoutState | undefined> {
    return this.inMemoryLockoutCache.get<LockoutState>(`lockout:${key}`);
  }

  async recordLockoutFailure(
    key: string,
    maxAttempts: number,
    lockDurationMs: number,
  ): Promise<LockoutState> {
    const entry = (await this.getLockout(key)) ?? { count: 0 };
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
  }

  isLocked(state: LockoutState | undefined): boolean {
    return Boolean(state?.lockedUntil && state.lockedUntil > Date.now());
  }
}
