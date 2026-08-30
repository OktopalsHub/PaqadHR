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
    this.logger.log('Rate limits using in-memory LRU cache (single-instance)');
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

  async checkRateLimit(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
    const now = Date.now();
    const windowMs = config.rules[0]?.windowMs || 60_000;
    const maxRequests = config.rules[0]?.maxRequests || 100;

    const result = this.inMemoryRateLimitCache.incrWithTtl(`ratelimit:${key}`, windowMs);
    const count = result.count;
    const resetTime = result.resetTime;

    if (count > maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime,
        retryAfter: Math.ceil((resetTime - now) / 1000),
      };
    }

    return {
      allowed: true,
      remaining: Math.max(0, maxRequests - count),
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
