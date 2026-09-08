import type { NestExpressApplication } from '@nestjs/platform-express';
import { type NextFunction, type Request, type Response } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

export const APPROVED_CLIENTS = (process.env.APPROVED_CLIENTS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function ipToNum(ip: string): number | null {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return null;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function isIpAllowed(ip: string): boolean {
  if (APPROVED_CLIENTS.includes(ip)) return true;
  for (const entry of APPROVED_CLIENTS) {
    if (!entry.includes('/')) continue;
    try {
      const [cidrIp, prefixStr] = entry.split('/');
      const prefix = Number(prefixStr);
      if (Number.isNaN(prefix) || prefix < 0 || prefix > 32) continue;
      const ipNum = ipToNum(ip);
      const cidrNum = ipToNum(cidrIp);
      if (ipNum === null || cidrNum === null) continue;
      const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
      if ((ipNum & mask) === (cidrNum & mask)) return true;
    } catch {
      // ignore malformed CIDR
    }
  }
  return false;
}

function isWalletMoneyPath(path: string): boolean {
  return /\/api\/v1\/tenants\/[^/]+\/rewards\/wallet\/topup(\/checkout)?\/?$/.test(path);
}

export const configureRateLimiters = (app: NestExpressApplication) => {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(req.ip || ''),
    message: {
      error: 'Too Many Requests',
      message: 'Too many requests from this IP, please try again later.',
      statusCode: 429,
    },
    skip: (req) => {
      const skipPaths = ['/health', '/metrics', '/csrf/token'];
      const securityProbes = ['/.git/', '/admin', '/wp-admin', '/.env'];
      const isWebhook =
        req.path.startsWith('/api/v1/webhooks') ||
        req.path.startsWith('/api/v1/subscriptions/webhooks') ||
        req.path.startsWith('/api/v1/payroll/webhooks');
      return (
        isWebhook ||
        skipPaths.includes(req.path) ||
        securityProbes.some((probe) => req.path.includes(probe))
      );
    },
  });
  app.use(limiter);
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
    keyGenerator: (req) => ipKeyGenerator(req.ip || ''),
    message: {
      error: 'Too Many Authentication Attempts',
      message: 'Too many authentication attempts from this IP, please try again later.',
      statusCode: 429,
    },
  });
  app.use('/api/v1/auth/login', authLimiter);
  app.use('/api/v1/auth/register', authLimiter);
  app.use('/api/v1/auth/forgot-password', authLimiter);
  app.use('/api/v1/auth/reset-password', authLimiter);
  const contactLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(req.ip || ''),
    message: {
      error: 'Too Many Requests',
      message: 'Too many contact form submissions from this IP, please try again later.',
      statusCode: 429,
    },
  });
  app.use('/api/v1/contact', contactLimiter);
  const webhookLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 50,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(req.ip || ''),
    message: {
      error: 'Too Many Webhook Requests',
      message: 'Too many webhook requests, please check your webhook configuration.',
      statusCode: 429,
    },
  });
  app.use('/api/v1/webhooks', webhookLimiter);
  app.use('/api/v1/subscriptions/webhooks', webhookLimiter);
  app.use('/api/v1/payroll/webhooks', webhookLimiter);
  const walletMoneyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(req.ip || ''),
    message: {
      error: 'Too Many Wallet Requests',
      message: 'Too many wallet funding requests from this IP, please try again later.',
      statusCode: 429,
    },
  });
  app.use((req: Request, res: Response, next: NextFunction) => {
    const path = req.path || req.url || '';
    if (isWalletMoneyPath(path)) {
      return walletMoneyLimiter(req, res, next);
    }
    next();
  });
  if (APPROVED_CLIENTS.length) {
    // eslint-disable-next-line no-console
    console.warn(
      `[security] APPROVED_CLIENTS allow-list active (${APPROVED_CLIENTS.length} entries) — health/metrics remain open`,
    );
  }
  app.use((req: Request, res: Response, next: NextFunction) => {
    const path = req.path || req.url || '';
    if (
      path.startsWith('/health') ||
      path.startsWith('/metrics') ||
      path.startsWith('/csrf/token') ||
      path.startsWith('/api/v1/webhooks') ||
      path.startsWith('/api/v1/subscriptions/webhooks') ||
      path.startsWith('/api/v1/payroll/webhooks')
    ) {
      return next();
    }
    const ip = req.ip || '';
    if (APPROVED_CLIENTS.length && !isIpAllowed(ip)) {
      return res.status(403).json({ message: 'Client not approved' });
    }
    next();
  });
};

export { isWalletMoneyPath };
