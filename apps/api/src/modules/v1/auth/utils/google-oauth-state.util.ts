import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { ENVIRONMENT } from 'src/common/config/env.config';
import { getPrivacyPolicyVersion } from 'src/common/config/privacy.config';

export const GOOGLE_OAUTH_CONSENT_COOKIE = 'google_oauth_consent';
export const GOOGLE_OAUTH_CONSENT_TTL_MS = 10 * 60 * 1000;

export interface GoogleOAuthConsentClaims {
  termsAccepted: boolean;
  privacyPolicyVersion: string;
  nonce: string;
  exp: number;
}

export function createGoogleOAuthConsentClaims(): GoogleOAuthConsentClaims {
  return {
    termsAccepted: true,
    privacyPolicyVersion: getPrivacyPolicyVersion(),
    nonce: randomBytes(16).toString('base64url'),
    exp: Date.now() + GOOGLE_OAUTH_CONSENT_TTL_MS,
  };
}

export function signGoogleOAuthConsent(claims: GoogleOAuthConsentClaims): string {
  const payload = Buffer.from(
    JSON.stringify({
      t: claims.termsAccepted ? 1 : 0,
      v: claims.privacyPolicyVersion,
      n: claims.nonce,
      exp: claims.exp,
    }),
  ).toString('base64url');
  const sig = createHmac('sha256', ENVIRONMENT.JWT.ACCESS_SECRET)
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyGoogleOAuthConsent(
  token: string | undefined,
): GoogleOAuthConsentClaims | null {
  if (!token?.includes('.')) {
    return null;
  }

  const [payload, sig] = token.split('.');
  if (!payload || !sig) {
    return null;
  }

  const expected = createHmac('sha256', ENVIRONMENT.JWT.ACCESS_SECRET)
    .update(payload)
    .digest('base64url');

  try {
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expected);
    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }
  } catch {
    return null;
  }

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      t?: number;
      v?: string;
      n?: string;
      exp?: number;
    };
    if (typeof data.exp !== 'number' || Date.now() > data.exp) {
      return null;
    }
    if (typeof data.v !== 'string' || !data.v || typeof data.n !== 'string' || !data.n) {
      return null;
    }
    return {
      termsAccepted: data.t === 1,
      privacyPolicyVersion: data.v,
      nonce: data.n,
      exp: data.exp,
    };
  } catch {
    return null;
  }
}

/** True when cookie and OAuth state are the same signed consent token. */
export function consentTokensMatch(
  cookieToken: string | undefined,
  stateToken: string | undefined,
): boolean {
  if (!cookieToken || !stateToken) {
    return false;
  }
  try {
    const a = Buffer.from(cookieToken);
    const b = Buffer.from(stateToken);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
