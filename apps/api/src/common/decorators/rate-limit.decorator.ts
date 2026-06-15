import { SetMetadata } from '@nestjs/common';
import type { RateLimitConfig } from '../interfaces/rate-limit-config.interface';

export const RATE_LIMIT_KEY = 'rateLimit';

export const RateLimit = (config: RateLimitConfig) => SetMetadata(RATE_LIMIT_KEY, config);

export const RateLimitPresets: Record<string, RateLimitConfig> = {
  SENSITIVE: {
    rules: [{ windowMs: 60000, maxRequests: 5 }],
  },
  API: {
    rules: [{ windowMs: 60000, maxRequests: 60 }],
  },
  PUBLIC: {
    rules: [{ windowMs: 60000, maxRequests: 100 }],
  },
  AUTH: {
    rules: [{ windowMs: 60000, maxRequests: 3 }],
  },
};
