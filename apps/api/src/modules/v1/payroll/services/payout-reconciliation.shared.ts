import { PayrollStatus } from 'src/common/enums/payroll-status.enum';
import { normalizePayoutStatus } from 'src/common/utils/payout-status.util';

import { PayrollItem } from '../entities/payroll-item.entity';
import { parsePayrollMerchantRef } from '../utils/payroll-merchant-ref.util';

export const PAYROLL_AMOUNT_TOLERANCE = 1;

/** How long a PROCESSING item with no provider transaction id may stay unqueried before
 * reconciliation declares it failed. Nothing was ever submitted for these, so the only
 * reason to wait is to let a slow provider error land first. */
export const NULL_TRANSACTION_STUCK_GRACE_MS = 60 * 60 * 1000;

export type ParsedMerchantRef = NonNullable<ReturnType<typeof parsePayrollMerchantRef>>;
export type NormalizedPayoutStatus = NonNullable<ReturnType<typeof normalizePayoutStatus>>;
export type TransferOutcome = { item: PayrollItem | null; kind: 'paid' | 'failed' | null };

/** Post-approval run status from item counts. Never returns `processing` (that means pre-approve). */
export function resolvePostApprovalPayrollStatus(counts: {
  pending: number;
  processing: number;
  paid: number;
  failed: number;
  active: number;
}): PayrollStatus {
  const inFlight = counts.pending + counts.processing;
  if (counts.active <= 0) return PayrollStatus.CANCELLED;
  if (inFlight > 0) return PayrollStatus.APPROVED;
  if (counts.paid === counts.active) return PayrollStatus.COMPLETED;
  if (counts.failed === counts.active) return PayrollStatus.FAILED;
  if (counts.paid > 0 && counts.failed > 0) return PayrollStatus.APPROVED;
  if (counts.paid > 0) return PayrollStatus.COMPLETED;
  return PayrollStatus.FAILED;
}
