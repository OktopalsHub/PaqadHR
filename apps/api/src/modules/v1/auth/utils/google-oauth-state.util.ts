import { createHmac, timingSafeEqual } from 'node:crypto';
import { ENVIRONMENT } from 'src/common/config/env.config';

const TTL_MS = 10 * 60 * 1000;

export function signGoogleOAuthState(termsAccepted: boolean): string {
  const payload = Buffer.from(
    JSON.stringify({
      t: termsAccepted ? 1 : 0,
      exp: Date.now() + TTL_MS,
    }),
  ).toString('base64url');
  const sig = createHmac('sha256', ENVIRONMENT.JWT.ACCESS_SECRET)
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyGoogleOAuthState(state: string | undefined): { termsAccepted: boolean } {
  if (!state?.includes('.')) {
    return { termsAccepted: false };
  }

  const [payload, sig] = state.split('.');
  if (!payload || !sig) {
    return { termsAccepted: false };
  }

  const expected = createHmac('sha256', ENVIRONMENT.JWT.ACCESS_SECRET)
    .update(payload)
    .digest('base64url');

  try {
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expected);
    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
      return { termsAccepted: false };
    }
  } catch {
    return { termsAccepted: false };
  }

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      t?: number;
      exp?: number;
    };
    if (typeof data.exp !== 'number' || Date.now() > data.exp) {
      return { termsAccepted: false };
    }
    return { termsAccepted: data.t === 1 };
  } catch {
    return { termsAccepted: false };
  }
}
