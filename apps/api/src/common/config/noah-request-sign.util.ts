import { createHash } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import jwt from 'jsonwebtoken';

const NOAH_JWT_AUDIENCE = 'https://api.noah.com';

export interface NoahJwtSignOptions {
  method: string;
  path: string;
  privateKey: string;
  body?: Buffer;
  queryParams?: Record<string, string | number>;
}

export function createNoahApiSignature(opts: NoahJwtSignOptions): string {
  const { method, path, privateKey, body, queryParams } = opts;

  const payload: Record<string, unknown> = {
    method: method.toUpperCase(),
    path,
  };

  if (body && body.length > 0) {
    payload.bodyHash = createHash('sha256').update(body).digest('hex');
  }

  if (queryParams && Object.keys(queryParams).length > 0) {
    payload.queryParams = queryParams;
  }

  try {
    return jwt.sign(payload, privateKey, {
      algorithm: 'ES384',
      audience: NOAH_JWT_AUDIENCE,
      expiresIn: '5m',
    });
  } catch {
    throw new BadRequestException(
      'Noah signing key is invalid — check NOAH_SIGNING_PRIVATE_KEY PEM format',
    );
  }
}

/** JWT path claim must include /v1 prefix (Noah docs use e.g. /v1/transactions). */
export function noahJwtPath(apiPath: string, baseUrl: string): string {
  const normalized = apiPath.startsWith('/') ? apiPath : `/${apiPath}`;
  try {
    const pathname = new URL(baseUrl).pathname.replace(/\/$/, '');
    if (pathname && !normalized.startsWith(pathname)) {
      return `${pathname}${normalized}`;
    }
  } catch {
    // fall through
  }
  return normalized.startsWith('/v1') ? normalized : `/v1${normalized}`;
}
