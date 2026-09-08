import { timingSafeEqual } from 'node:crypto';

/** Constant-time compare for webhook HMAC digests. Callers lowercase both sides first when the provider spec is case-insensitive. */
export function signaturesMatch(expected: string, received: string): boolean {
  try {
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(received, 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
