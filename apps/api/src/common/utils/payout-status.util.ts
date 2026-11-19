import { TransactionStatus } from '../enums/payment-provider.enum';

/**
 * The single payout status vocabulary. Provider adapters report their own strings; payroll
 * decides paid / in flight / failed only through the sets and helpers below. ACCEPTED means the
 * provider has queued the transfer; it stays in flight until a success status is confirmed.
 */
export const PAYOUT_SUCCESS_STATUSES: ReadonlySet<string> = new Set([
  'SUCCESS',
  'SUCCESSFUL',
  'COMPLETED',
  'PAYMENT_SUCCESSFUL',
  'SUCCEEDED',
  'PAID',
  'SETTLED',
]);

export const PAYOUT_PENDING_STATUSES: ReadonlySet<string> = new Set([
  'PENDING',
  'PENDING_BILLING',
  'PROCESSING',
  'IN_PROGRESS',
  'PENDING_AUTHORIZATION',
  'AWAITING_AUTHORIZATION',
  'AWAITING_PROCESSING',
  'ACCEPTED',
]);

export const PAYOUT_FAILED_STATUSES: ReadonlySet<string> = new Set([
  'FAILED',
  'REFUND',
  'REVERSED',
  'CANCELLED',
  'CANCELED',
  'REJECTED',
]);

export function isPayoutSuccessStatus(status: string): boolean {
  return PAYOUT_SUCCESS_STATUSES.has(status.trim().toUpperCase());
}

export function isPayoutPendingStatus(status: string): boolean {
  return PAYOUT_PENDING_STATUSES.has(status.trim().toUpperCase());
}

export function isPayoutFailedStatus(status: string): boolean {
  return PAYOUT_FAILED_STATUSES.has(status.trim().toUpperCase());
}

/** Normalize a provider payout state before payroll state transitions; null when unknown. */
export function normalizePayoutStatus(rawStatus: string): TransactionStatus | null {
  const status = rawStatus.trim().toUpperCase();
  if (PAYOUT_SUCCESS_STATUSES.has(status)) return TransactionStatus.COMPLETED;
  if (PAYOUT_FAILED_STATUSES.has(status)) return TransactionStatus.FAILED;
  if (PAYOUT_PENDING_STATUSES.has(status)) return TransactionStatus.PROCESSING;
  return null;
}
