import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import passport from 'passport';

import { correlationIdMiddleware } from '../observability/correlation-id.middleware';
import { csrfOriginMiddleware } from './csrf-origin.middleware';
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
      limit: process.env.JSON_BODY_LIMIT ?? '1mb',
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
  app.use(
    express.urlencoded({
      limit: process.env.URLENCODED_BODY_LIMIT ?? '1mb',
      extended: true,
    }),
  );
  app.use(csrfOriginMiddleware);
  const trustProxy = Number.parseInt(process.env.TRUST_PROXY ?? '0', 10);
  app.set('trust proxy', Number.isFinite(trustProxy) && trustProxy > 0 ? trustProxy : false);
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
        if (process.env.NODE_ENV === 'production' && allowedOrigins.length === 0) {
          return callback(new Error('CORS is not configured for production'), false);
        }
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
      // Lets browsers cache the preflight so each API call stops costing an extra OPTIONS round trip.
      maxAge: 600,
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
