import { TransactionStatus } from '../enums/payment-provider.enum';

/**
 * The single payout status vocabulary. Provider adapters report their own strings; payroll
 * decides paid / in flight / failed only through the sets and helpers below.
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
]);

export const PAYOUT_FAILED_STATUSES: ReadonlySet<string> = new Set([
  'FAILED',
  'REFUND',
  'REVERSED',
  'CANCELLED',
  'CANCELED',
  'REJECTED',
]);

/**
 * Statuses a provider status query may report when a payout debit is recorded in the funding
 * ledger. ACCEPTED is accepted here only as verification evidence for a payout that payroll
 * already holds as paid; it never moves an item to paid by itself (see normalizePayoutStatus).
 */
export const PAYOUT_DEBIT_EVIDENCE_STATUSES: ReadonlySet<string> = new Set([
  ...PAYOUT_SUCCESS_STATUSES,
  'ACCEPTED',
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

export function isPayoutDebitEvidenceStatus(status: string): boolean {
  return PAYOUT_DEBIT_EVIDENCE_STATUSES.has(status.trim().toUpperCase());
}

/** Normalize a provider payout state before payroll state transitions; null when unknown. */
export function normalizePayoutStatus(rawStatus: string): TransactionStatus | null {
  const status = rawStatus.trim().toUpperCase();
  if (PAYOUT_SUCCESS_STATUSES.has(status)) return TransactionStatus.COMPLETED;
  if (PAYOUT_FAILED_STATUSES.has(status)) return TransactionStatus.FAILED;
  if (PAYOUT_PENDING_STATUSES.has(status)) return TransactionStatus.PROCESSING;
  return null;
}
