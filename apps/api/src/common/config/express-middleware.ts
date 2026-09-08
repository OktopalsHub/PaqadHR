import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import csurf from 'csurf';
import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import passport from 'passport';
import { correlationIdMiddleware } from '../observability/correlation-id.middleware';
import { resolveCookieDomain, usesCrossSiteCookies, usesSecureCookies } from './cookie-deployment';
import { isTrustedOrigin, resolveTrustedOrigins } from './trusted-origins';

type RequestWithRawBody = Request & { rawBody?: Buffer };

export const configureMiddleware = (app: NestExpressApplication) => {
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
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
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
      },
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      originAgentCluster: true,
      dnsPrefetchControl: { allow: false },
      frameguard: { action: 'deny' },
      hidePoweredBy: true,
      hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
      ieNoOpen: true,
      noSniff: true,
      permittedCrossDomainPolicies: { permittedPolicies: 'none' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      xssFilter: true,
    }),
  );
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=()',
    );
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  });
};
