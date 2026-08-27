import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import csurf from 'csurf';
import express, { type NextFunction, type Request, type Response } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import helmet, { type HelmetOptions } from 'helmet';
import helmetCsp from 'helmet-csp';
import morgan from 'morgan';
import passport from 'passport';
import { resolveCookieDomain, usesCrossSiteCookies, usesSecureCookies } from './cookie-deployment';
import { isTrustedOrigin, resolveTrustedOrigins } from './trusted-origins';

type RequestWithRawBody = Request & { rawBody?: Buffer };

export function isWalletMoneyPath(path: string): boolean {
  return /\/api\/v1\/tenants\/[^/]+\/rewards\/wallet\/topup(\/checkout)?\/?$/.test(path);
}

export const ExpressSetup = (app: NestExpressApplication) => {
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
      ],
      optionsSuccessStatus: 200,
    }),
  );
  const contentSecurityPolicy = {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'"],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  };
  app.use(
    helmet({
      contentSecurityPolicy: false,
    }),
  );
  app.use(helmetCsp(contentSecurityPolicy));
  const helmetConfig: HelmetOptions = {
    frameguard: { action: 'deny' },
    xssFilter: true,
    referrerPolicy: { policy: 'strict-origin' },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  };
  app.use(helmet(helmetConfig));
  app.use(helmet.hidePoweredBy());
  app.use(helmet.noSniff());
  app.use(helmet.ieNoOpen());
  app.use(helmet.dnsPrefetchControl());
  app.use(helmet.permittedCrossDomainPolicies());
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
    // Only count failed attempts so brute-force is still blocked while a
    // legitimate user's successful logins don't lock them out of their account.
    skipSuccessfulRequests: true,
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
  app.use((req: Request, res: Response, next: NextFunction) => {
    const path = req.path || req.url || '';
    if (
      path.startsWith('/api/v1/webhooks') ||
      path.startsWith('/api/v1/subscriptions/webhooks') ||
      path.startsWith('/api/v1/payroll/webhooks')
    ) {
      return next();
    }
    const ip = req.ip || '';
    if (APPROVED_CLIENTS.length && !APPROVED_CLIENTS.includes(ip)) {
      return res.status(403).json({ message: 'Client not approved' });
    }
    next();
  });
};
