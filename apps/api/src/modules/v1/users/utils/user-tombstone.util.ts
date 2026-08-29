import { createHash } from 'node:crypto';

const TOMBSTONE_DOMAIN = 'anonymized.paqad.local';
const MAX_EMAIL_LENGTH = 100;

/** Opaque tombstone email that frees the unique constraint without retaining PII. */
export function buildDeletedUserEmail(userId: string): string {
  const hash = createHash('sha256').update(userId).digest('hex').slice(0, 16);
  const tombstone = `deleted_${Date.now()}_${hash}@${TOMBSTONE_DOMAIN}`;
  return tombstone.length <= MAX_EMAIL_LENGTH ? tombstone : tombstone.slice(0, MAX_EMAIL_LENGTH);
}
