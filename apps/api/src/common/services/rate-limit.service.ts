import { Injectable, Logger } from '@nestjs/common';
import { RateLimitRule } from "../interfaces/rate-limit-rule.interface";
import { RateLimitConfig } from "../interfaces/rate-limit-config.interface";
import { RateLimitResult } from "../interfaces/rate-limit-result.interface";

@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);
  private readonly requestCounts = new Map<string, number[]>();
  async checkRateLimit(
    key: string,
    config: RateLimitConfig,
  ): Promise<RateLimitResult> {
    const now = Date.now();
    this.cleanupOldRequests(key, config.rules[0]?.windowMs || 60000);
    const currentCount = this.requestCounts.get(key)?.length || 0;
    const maxRequests = config.rules[0]?.maxRequests || 100;
    if (currentCount >= maxRequests) {
      const resetTime = now + (config.rules[0]?.windowMs || 60000);
      return {
        allowed: false,
        remaining: 0,
        resetTime,
        retryAfter: Math.ceil((resetTime - now) / 1000),
      };
    }
    if (!this.requestCounts.has(key)) {
      this.requestCounts.set(key, []);
    }
    this.requestCounts.get(key)!.push(now);
    return {
      allowed: true,
      remaining: maxRequests - currentCount - 1,
      resetTime: now + (config.rules[0]?.windowMs || 60000),
    };
  }
  async clearRateLimit(key: string): Promise<void> {
    this.requestCounts.delete(key);
  }
  private cleanupOldRequests(key: string, windowMs: number): void {
    const requests = this.requestCounts.get(key);
    if (!requests) return;
    const cutoff = Date.now() - windowMs;
    const filtered = requests.filter(timestamp => timestamp > cutoff);
    if (filtered.length === 0) {
      this.requestCounts.delete(key);
    } else {
      this.requestCounts.set(key, filtered);
    }
  }
}
