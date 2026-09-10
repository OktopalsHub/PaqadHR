import { createHmac } from 'node:crypto';

/**
 * Produces a stable, non-reversible identifier for third-party product analytics.
 * Raw user and tenant IDs must never leave the application for analytics.
 */
export function pseudonymizeAnalyticsIdentifier(
  namespace: 'actor' | 'tenant',
  identifier: string,
  salt: string,
): string {
  return `${namespace}_${createHmac('sha256', salt).update(identifier).digest('hex')}`;
}
