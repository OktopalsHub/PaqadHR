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
const STATE_MAX_LENGTH = 2048;
const OAUTH_STATE_KEY_CONTEXT = 'paqad-oauth-state-v1';

function oauthStateSigningKey(): string {
  return createHmac('sha256', ENVIRONMENT.JWT.ACCESS_SECRET)
    .update(OAUTH_STATE_KEY_CONTEXT)
    .digest('base64url');
}

function signPayload(encodedPayload: string): string {
  return createHmac('sha256', oauthStateSigningKey()).update(encodedPayload).digest('base64url');
}

function toBase64Url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function fromBase64Url(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

export function signOAuthState(payload: OAuthStatePayload): string {
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = signPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifyOAuthState(state: string): OAuthStatePayload {
  if (!state || state.length > STATE_MAX_LENGTH) {
    throw new Error('Invalid OAuth state length');
  }

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
