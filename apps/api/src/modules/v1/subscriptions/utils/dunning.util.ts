import {
  DUNNING_RETRY_INTERVALS_DAYS,
  RENEWAL_GRACE_PERIOD_DAYS,
} from '../constants/billing.constants';

export function maxDunningAttempts(): number {
  return DUNNING_RETRY_INTERVALS_DAYS.length;
}

/**
 * Schedule the next dunning retry from the billing anchor.
 * `attemptCountAfterFailure` is 1-based (1 = first failure → first interval).
 */
export function computeDunningNextRetryAt(
  billingAnchor: Date,
  attemptCountAfterFailure: number,
): Date | null {
  const index = attemptCountAfterFailure - 1;
  if (index < 0 || index >= DUNNING_RETRY_INTERVALS_DAYS.length) {
    return null;
  }
  const at = new Date(billingAnchor);
  at.setDate(at.getDate() + DUNNING_RETRY_INTERVALS_DAYS[index]!);
  return at;
}

export function isWithinRenewalGrace(billingAnchor: Date, now = new Date()): boolean {
  const graceEnd = new Date(billingAnchor);
  graceEnd.setDate(graceEnd.getDate() + RENEWAL_GRACE_PERIOD_DAYS);
  return now < graceEnd;
}
