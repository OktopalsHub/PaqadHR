import type { NestExpressApplication } from '@nestjs/platform-express';
import { configureMiddleware } from './express-middleware';
import { configureRateLimiters } from './express-rate-limiters';

export function isWalletMoneyPath(path: string): boolean {
  return /\/api\/v1\/tenants\/[^/]+\/rewards\/wallet\/topup(\/checkout)?\/?$/.test(path);
}

export const ExpressSetup = (app: NestExpressApplication) => {
  configureMiddleware(app);
  configureRateLimiters(app);
};
