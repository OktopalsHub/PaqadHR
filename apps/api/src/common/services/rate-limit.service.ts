import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { createClient, type RedisClientType } from 'redis';
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
  // Great in-memory fallback — LRU + TTL + size bounds + tenant isolation (no Redis required)
  private readonly inMemoryRateLimitCache: InMemoryCacheService;
  private readonly inMemoryLockoutCache: InMemoryCacheService;
  private readonly redis: RedisClientType | null;
  private readonly redisReady: Promise<void> | null;

  constructor() {
    // Great in-memory caches — 5000 entries, 10MB each, LRU eviction, 1m cleanup
    this.inMemoryRateLimitCache = new InMemoryCacheService({
      maxEntries: 5000,
      maxMemoryBytes: 10 * 1024 * 1024,
      defaultTtlMs: 15 * 60 * 1000,
      namespace: 'rate-limit',
    });
    this.inMemoryLockoutCache = new InMemoryCacheService({
      maxEntries: 2000,
      maxMemoryBytes: 5 * 1024 * 1024,
      defaultTtlMs: 30 * 60 * 1000,
      namespace: 'lockout',
    });
    const url = process.env.REDIS_URL?.trim();
    if (url) {
      this.redis = createClient({ url });
      this.redisReady = this.redis
        .connect()
        .then(() => {
          this.logger.log('Rate limits using Redis (primary) + great in-memory fallback ready');
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.error(
            `Redis connection failed; using great in-memory rate limits: ${message}`,
          );
        });
    } else {
      this.redis = null;
      this.redisReady = null;
      this.logger.log(
        'Rate limits using great in-memory LRU cache (Redis not configured) — production single-instance or dev only',
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.redisReady;
    await this.redis?.quit();
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
    await this.redisReady;

    const now = Date.now();
    const windowMs = config.rules[0]?.windowMs || 60_000;
    const maxRequests = config.rules[0]?.maxRequests || 100;

    if (this.redis?.isOpen) {
      const redisKey = `ratelimit:${key}`;
      const count = await this.redis.incr(redisKey);
      if (count === 1) {
        await this.redis.pExpire(redisKey, windowMs);
      }
      const ttlMs = await this.redis.pTTL(redisKey);
      const resetTime = now + Math.max(ttlMs, 0);

      if (count > maxRequests) {
        return {
          allowed: false,
          remaining: 0,
          resetTime,
          retryAfter: Math.ceil(Math.max(ttlMs, 0) / 1000),
        };
      }

      return {
        allowed: true,
        remaining: Math.max(0, maxRequests - count),
        resetTime,
      };
    }

    // Great in-memory path — atomic incrWithTtl via LRU cache
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
    await this.redisReady;
    if (this.redis?.isOpen) {
      await this.redis.del(`ratelimit:${key}`);
      return;
    }
    this.inMemoryRateLimitCache.delete(`ratelimit:${key}`);
  }

  async getLockout(key: string): Promise<LockoutState | undefined> {
    await this.redisReady;
    if (this.redis?.isOpen) {
      const raw = await this.redis.get(`lockout:${key}`);
      return raw ? (JSON.parse(raw) as LockoutState) : undefined;
    }
    return this.inMemoryLockoutCache.get<LockoutState>(`lockout:${key}`);
  }

  async recordLockoutFailure(
    key: string,
    maxAttempts: number,
    lockDurationMs: number,
  ): Promise<LockoutState> {
    await this.redisReady;
    const entry = (await this.getLockout(key)) ?? { count: 0 };
    entry.count += 1;
    if (entry.count >= maxAttempts) {
      entry.lockedUntil = Date.now() + lockDurationMs;
    }

    if (this.redis?.isOpen) {
      const ttlMs = entry.lockedUntil
        ? Math.max(entry.lockedUntil - Date.now(), lockDurationMs)
        : lockDurationMs;
      await this.redis.set(`lockout:${key}`, JSON.stringify(entry), { PX: ttlMs });
    } else {
      const ttlMs = entry.lockedUntil
        ? Math.max(entry.lockedUntil - Date.now(), lockDurationMs)
        : lockDurationMs;
      this.inMemoryLockoutCache.set(`lockout:${key}`, entry, ttlMs);
    }

    return entry;
  }

  async clearLockout(key: string): Promise<void> {
    await this.redisReady;
    if (this.redis?.isOpen) {
      await this.redis.del(`lockout:${key}`);
      return;
    }
    this.inMemoryLockoutCache.delete(`lockout:${key}`);
  }

  isLocked(state: LockoutState | undefined): boolean {
    return Boolean(state?.lockedUntil && state.lockedUntil > Date.now());
  }
}
