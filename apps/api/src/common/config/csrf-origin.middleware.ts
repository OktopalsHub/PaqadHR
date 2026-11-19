import type { NextFunction, Request, Response } from 'express';

import { ACCESS_TOKEN_COOKIE, cookieName } from './cookie-deployment';
import { isTrustedOrigin } from './trusted-origins';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const EXCLUDED_PATHS = [
  '/api/v1/auth/register',
  '/api/v1/auth/login',
  '/api/v1/auth/logout',
  '/api/v1/auth/refresh',
  '/api/v1/auth/forgot-password',
  '/api/v1/auth/reset-password',
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

function requestOrigin(req: Request): string | undefined {
  const origin = req.headers.origin;
  if (origin) return origin;
  const referer = req.headers.referer;
  if (!referer) return undefined;
  try {
    return new URL(referer).origin;
  } catch {
    return undefined;
  }
}

export function csrfOriginMiddleware(req: Request, res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method)) return next();
  if (EXCLUDED_PATHS.some((path) => req.path.startsWith(path))) return next();
  const hasBearerAuth = req.headers.authorization?.startsWith('Bearer ') ?? false;
  const hasAuthCookie = req.cookies?.[cookieName(ACCESS_TOKEN_COOKIE)] !== undefined;
  if (hasBearerAuth && !hasAuthCookie) return next();

  const origin = requestOrigin(req);
  if (origin && isTrustedOrigin(origin)) return next();
  return res.status(403).json({
    message: 'Untrusted request origin',
    error: 'Forbidden',
    statusCode: 403,
  });
}
