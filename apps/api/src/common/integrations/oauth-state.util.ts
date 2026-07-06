import { createHmac, timingSafeEqual } from 'node:crypto';
import { ENVIRONMENT } from 'src/common/config/env.config';
import type { IntegrationType } from 'src/common/enums';

export type OAuthStatePayload = {
  tenantId: string;
  tenantMemberId: string;
  platformType: IntegrationType;
  timestamp: number;
};

const STATE_MAX_AGE_MS = 10 * 60 * 1000;

function toBase64Url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function fromBase64Url(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function signPayload(encodedPayload: string): string {
  return createHmac('sha256', ENVIRONMENT.JWT.ACCESS_SECRET)
    .update(encodedPayload)
    .digest('base64url');
}

export function signOAuthState(payload: OAuthStatePayload): string {
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = signPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifyOAuthState(state: string): OAuthStatePayload {
  const [encodedPayload, signature] = state.split('.');
  if (!encodedPayload || !signature) {
    throw new Error('Invalid OAuth state format');
  }

  const expected = signPayload(encodedPayload);
  const sigBuffer = Buffer.from(signature, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
    throw new Error('Invalid OAuth state signature');
  }

  const payload = JSON.parse(fromBase64Url(encodedPayload)) as OAuthStatePayload;
  if (!payload.tenantId || !payload.tenantMemberId || !payload.platformType) {
    throw new Error('Missing required OAuth state fields');
  }

  const stateAge = Date.now() - (payload.timestamp || 0);
  if (stateAge > STATE_MAX_AGE_MS) {
    throw new Error('OAuth state expired');
  }

  return payload;
}
