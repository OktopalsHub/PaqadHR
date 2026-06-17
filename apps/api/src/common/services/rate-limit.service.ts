import { Injectable } from '@nestjs/common';
import type { RateLimitConfig } from '../interfaces/rate-limit-config.interface';
import type { RateLimitResult } from '../interfaces/rate-limit-result.interface';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

@Injectable()
export class RateLimitService {
  /** Process-memory store. Swap for Redis when running multiple API instances. */
  private readonly store = new Map<string, RateLimitEntry>();

  async checkRateLimit(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
    const now = Date.now();
    const windowMs = config.rules[0]?.windowMs || 60_000;
    const maxRequests = config.rules[0]?.maxRequests || 100;

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
    this.store.delete(key);
  }
}
