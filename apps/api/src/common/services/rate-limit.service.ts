import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { createClient, type RedisClientType } from 'redis';
import type { RateLimitConfig } from '../interfaces/rate-limit-config.interface';
import type { RateLimitResult } from '../interfaces/rate-limit-result.interface';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

export interface LockoutState {
  count: number;
  lockedUntil?: number;
}

@Injectable()
export class RateLimitService implements OnModuleDestroy {
  private readonly logger = new Logger(RateLimitService.name);
  private readonly store = new Map<string, RateLimitEntry>();
  private readonly lockoutStore = new Map<string, LockoutState>();
  private readonly redis: RedisClientType | null;
  private readonly redisReady: Promise<void> | null;

  constructor() {
    const url = process.env.REDIS_URL?.trim();
    if (url) {
      this.redis = createClient({ url });
      this.redisReady = this.redis
        .connect()
        .then(() => {
          this.logger.log('Rate limits using Redis');
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.error(
            `Redis connection failed; falling back to in-memory rate limits: ${message}`,
          );
        });
    } else {
      this.redis = null;
      this.redisReady = null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.redisReady;
    await this.redis?.quit();
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

    let entry = this.store.get(key);
    if (!entry || now >= entry.resetTime) {
      entry = { count: 0, resetTime: now + windowMs };
      this.store.set(key, entry);
    }

    entry.count += 1;

    if (entry.count > maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
        retryAfter: Math.ceil((entry.resetTime - now) / 1000),
      };
    }

    return {
      allowed: true,
      remaining: Math.max(0, maxRequests - entry.count),
      resetTime: entry.resetTime,
    };
  }

  async clearRateLimit(key: string): Promise<void> {
    await this.redisReady;
    if (this.redis?.isOpen) {
      await this.redis.del(`ratelimit:${key}`);
      return;
    }
    this.store.delete(key);
  }

  async getLockout(key: string): Promise<LockoutState | undefined> {
    await this.redisReady;
    if (this.redis?.isOpen) {
      const raw = await this.redis.get(`lockout:${key}`);
      return raw ? (JSON.parse(raw) as LockoutState) : undefined;
    }
    return this.lockoutStore.get(key);
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
      this.lockoutStore.set(key, entry);
    }

    return entry;
  }

  async clearLockout(key: string): Promise<void> {
    await this.redisReady;
    if (this.redis?.isOpen) {
      await this.redis.del(`lockout:${key}`);
      return;
    }
    this.lockoutStore.delete(key);
  }

  isLocked(state: LockoutState | undefined): boolean {
    return Boolean(state?.lockedUntil && state.lockedUntil > Date.now());
  }
}
