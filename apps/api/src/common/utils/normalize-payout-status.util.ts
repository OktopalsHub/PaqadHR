import { PaymentProvider, TransactionStatus } from '../enums/payment-provider.enum';

const SUCCESS = new Set([
  'SUCCESS',
  'SUCCESSFUL',
  'COMPLETED',
  'PAYMENT_SUCCESSFUL',
  'SUCCEEDED',
  'PAID',
  'SETTLED',
]);
const PROCESSING = new Set([
  'PENDING',
  'PENDING_BILLING',
  'PROCESSING',
  'IN_PROGRESS',
  'PENDING_AUTHORIZATION',
  'AWAITING_AUTHORIZATION',
  'AWAITING_PROCESSING',
]);
const FAILED = new Set(['FAILED', 'REFUND', 'REVERSED', 'CANCELLED', 'CANCELED', 'REJECTED']);

/** Normalize provider-specific payout lifecycle states before applying payroll state transitions. */
export function normalizePayoutStatus(
  provider: PaymentProvider,
  rawStatus: string,
): TransactionStatus {
  const status = rawStatus.trim().toUpperCase();
  switch (provider) {
    case PaymentProvider.NOAH:
      if (['SETTLED', 'COMPLETED', 'SUCCESS', 'SUCCEEDED'].includes(status))
        return TransactionStatus.COMPLETED;
      if (['FAILED', 'REJECTED', 'CANCELLED', 'CANCELED'].includes(status))
        return TransactionStatus.FAILED;
      return TransactionStatus.PROCESSING;
    case PaymentProvider.BACHS:
      if (['COMPLETED', 'SUCCESS', 'SUCCESSFUL', 'SETTLED'].includes(status))
        return TransactionStatus.COMPLETED;
      if (['FAILED', 'REVERSED', 'REJECTED', 'CANCELLED', 'CANCELED'].includes(status))
        return TransactionStatus.FAILED;
      return TransactionStatus.PROCESSING;
    default:
      if (SUCCESS.has(status)) return TransactionStatus.COMPLETED;
      if (FAILED.has(status)) return TransactionStatus.FAILED;
      if (PROCESSING.has(status)) return TransactionStatus.PROCESSING;
      return TransactionStatus.PROCESSING;
  }
}
