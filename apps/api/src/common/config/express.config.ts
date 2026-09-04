import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import csurf from 'csurf';
import express, { type NextFunction, type Request, type Response } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';
import passport from 'passport';
import { correlationIdMiddleware } from '../observability/correlation-id.middleware';
import { resolveCookieDomain, usesCrossSiteCookies, usesSecureCookies } from './cookie-deployment';
import { isTrustedOrigin, resolveTrustedOrigins } from './trusted-origins';

type RequestWithRawBody = Request & { rawBody?: Buffer };

export function isWalletMoneyPath(path: string): boolean {
  return /\/api\/v1\/tenants\/[^/]+\/rewards\/wallet\/topup(\/checkout)?\/?$/.test(path);
}

export const ExpressSetup = (app: NestExpressApplication) => {
  app.use(correlationIdMiddleware);
  app.use(cookieParser());
  if (process.env.NODE_ENV !== 'production') {
    app.use(morgan('dev'));
  }
  app.use(
    express.json({
      limit: '10mb',
      verify: (req, _res, buf) => {
        const path = (req as Request).originalUrl ?? (req as Request).url ?? '';
        if (
          path.startsWith('/api/v1/webhooks') ||
          path.startsWith('/api/v1/subscriptions/webhooks') ||
          path.startsWith('/api/v1/payroll/webhooks')
        ) {
          (req as RequestWithRawBody).rawBody = buf;
        }
      },
    }),
  );
  app.use(express.urlencoded({ limit: '10mb', extended: true }));
  const crossSiteCookies = usesCrossSiteCookies();
  const secureCookies = usesSecureCookies();
  const cookieDomain = resolveCookieDomain();
  const csrfProtection = csurf({
    cookie: {
      httpOnly: true,
      sameSite: crossSiteCookies ? 'none' : 'lax',
      secure: secureCookies,
      maxAge: 3600000,
      ...(cookieDomain ? { domain: cookieDomain } : {}),
    },
    ignoreMethods: ['GET', 'HEAD', 'OPTIONS'],
  });
  app.use((req: Request, res: Response, next: NextFunction) => {
    const excludedPaths = [
      '/api/v1/auth/register',
      '/api/v1/auth/login',
      '/api/v1/auth/logout',
      '/api/v1/auth/refresh',
      '/api/v1/auth/forgot-password',
      '/api/v1/auth/reset-password',
      '/api/v1/auth/github/callback',
      '/api/v1/auth/google/callback',
      '/api/v1/integrations/oauth/callback',
      '/api/v1/invitations/details',
      '/api/v1/invitations/accept',
      '/api/v1/invitations/decline',
      '/api/v1/webhooks',
      '/api/v1/subscriptions/webhooks',
      '/api/v1/payroll/webhooks',
      '/health',
      '/metrics',
    ];
    const isExcludedPath = excludedPaths.some((path) => req.path.startsWith(path));
    // Bearer-authenticated requests are not CSRF-vulnerable (the token isn't
    // sent automatically by the browser) and the CSRF secret cookie can't
    // survive a cross-domain deployment, so skip CSRF for them. Cookie-based
    // requests still go through CSRF protection.
    const hasBearerAuth = req.headers.authorization?.startsWith('Bearer ') ?? false;
    const hasAuthCookie = req.cookies?.access_token !== undefined;
    if (isExcludedPath || (hasBearerAuth && !hasAuthCookie)) {
      return next();
    }
    csrfProtection(req, res, next);
  });
  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'EBADCSRFTOKEN') {
      return res.status(403).json({
        message: 'Invalid CSRF token',
        error: 'Forbidden',
        statusCode: 403,
        details: 'CSRF token validation failed. Please refresh the page and try again.',
      });
    }
    next(err);
  });
  app.set('trust proxy', true);
  app.use(passport.initialize());
  let allowedOrigins = resolveTrustedOrigins();
  const allowAll = allowedOrigins.includes('*');
  if (allowAll && process.env.NODE_ENV !== 'production') {
    allowedOrigins = ['*'];
  } else if (allowAll) {
    allowedOrigins = allowedOrigins.filter((o) => o !== '*');
  }
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes('*')) return callback(null, true);
        if (process.env.NODE_ENV === 'development') {
          try {
            const host = new URL(origin).hostname;
            if (host === 'localhost' || host === '127.0.0.1') {
              return callback(null, true);
            }
            const devSuffixes = [
              '.vercel.app',
              '.netlify.app',
              '.devtunnels.ms',
              '.ngrok.io',
              '.ngrok-free.app',
            ];
            if (devSuffixes.some((suffix) => host.endsWith(suffix))) {
              return callback(null, true);
            }
          } catch {
            // invalid URL — reject below
          }
        }
        if (allowedOrigins.includes(origin)) return callback(null, true);
        if (isTrustedOrigin(origin)) return callback(null, true);
        callback(new Error(`Not allowed by CORS: ${origin}`), false);
      },
      credentials: true,
      methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Origin',
        'Access-Control-Allow-Origin',
        'Access-Control-Allow-Headers',
        'Access-Control-Allow-Credentials',
        'x-csrf-token',
        'X-CSRF-Token',
        'x-tenant-id',
        'X-Tenant-ID',
        'x-correlation-id',
        'X-Correlation-Id',
      ],
      exposedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Origin',
        'Access-Control-Allow-Origin',
        'Access-Control-Allow-Headers',
        'Access-Control-Allow-Credentials',
        'x-csrf-token',
        'X-CSRF-Token',
        'x-correlation-id',
        'X-Correlation-Id',
      ],
      optionsSuccessStatus: 200,
    }),
  );
  // Great helmet — comprehensive security headers (OWASP + ASVS, in-memory optimized, no external deps)
  const contentSecurityPolicy = {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // API serves no HTML, but allow for Swagger
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: [],
    },
  };
  app.use(
    helmet({
      contentSecurityPolicy,
      crossOriginEmbedderPolicy: false, // R2/S3 presigned PUT requires cross-origin
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      originAgentCluster: true,
      dnsPrefetchControl: { allow: false },
      frameguard: { action: 'deny' },
      hidePoweredBy: true,
      hsts: { maxAge: 63072000, includeSubDomains: true, preload: true }, // 2 years, great
      ieNoOpen: true,
      noSniff: true,
      permittedCrossDomainPolicies: { permittedPolicies: 'none' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      xssFilter: true,
    }),
  );
  // Permissions-Policy — disable sensitive browser features for API
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=()',
    );
    // Extra hardening headers not covered by helmet
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    // HSTS already via helmet, but ensure preload header present even on http->https redirect
    next();
  });
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
    // M-4: Count all auth attempts (do not skip successful) to prevent interleaved bypass; legitimate users rarely hit 5/15m
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
  // NOTE: /api/v1/auth/refresh is intentionally NOT under authLimiter — the
  // client refreshes tokens automatically (it is not a login attempt) and the
  // refresh token is unguessable. It stays covered by the general limiter above.
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
  const APPROVED_CLIENTS = (process.env.APPROVED_CLIENTS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  // L-3: Support CIDR and allow health/metrics probes
  function isIpAllowed(ip: string): boolean {
    if (APPROVED_CLIENTS.includes(ip)) return true;
    // Simple CIDR check for IPv4 (e.g., 10.0.0.0/24)
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
  function ipToNum(ip: string): number | null {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return null;
    return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
  }
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
