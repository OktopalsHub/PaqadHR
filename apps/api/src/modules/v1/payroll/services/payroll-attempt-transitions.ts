import type { PayrollFundingAttemptStatus } from '../entities/payroll-funding-attempt.entity';
import type { PayrollPayoutAttemptStatus } from '../entities/payroll-payout-attempt.entity';

export const FUNDING_TRANSITIONS: Record<
  PayrollFundingAttemptStatus,
  ReadonlySet<PayrollFundingAttemptStatus>
> = {
  created: new Set([
    'pending',
    'processing',
    'confirmed',
    'failed',
    'cancelled',
    'expired',
    'requires_review',
  ]),
  pending: new Set([
    'processing',
    'confirmed',
    'failed',
    'cancelled',
    'expired',
    'requires_review',
  ]),
  processing: new Set(['confirmed', 'failed', 'requires_review']),
  confirmed: new Set(['reversed']),
  reversed: new Set(),
  failed: new Set(['reversed']),
  cancelled: new Set(['confirmed', 'requires_review']),
  expired: new Set(['confirmed', 'requires_review']),
  requires_review: new Set(['confirmed', 'failed', 'cancelled']),
};

export const PAYOUT_TRANSITIONS: Record<
  PayrollPayoutAttemptStatus,
  ReadonlySet<PayrollPayoutAttemptStatus>
> = {
  created: new Set(['processing', 'payment_processed', 'failed', 'requires_review']),
  processing: new Set(['payment_processed', 'failed', 'requires_review', 'reversed']),
  payment_processed: new Set(['reversed']),
  failed: new Set(),
  requires_review: new Set(['payment_processed', 'failed', 'reversed']),
  reversed: new Set(),
};
