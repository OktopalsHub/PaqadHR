import { TransactionStatus } from '../enums/payment-provider.enum';
import {
  isPayoutFailedStatus,
  isPayoutPendingStatus,
  isPayoutSuccessStatus,
  normalizePayoutStatus,
} from './payout-status.util';

describe('payout status vocabulary', () => {
  it('normalizes terminal and in-flight states regardless of case', () => {
    expect(normalizePayoutStatus('Settled')).toBe(TransactionStatus.COMPLETED);
    expect(normalizePayoutStatus('reversed')).toBe(TransactionStatus.FAILED);
    expect(normalizePayoutStatus(' pending ')).toBe(TransactionStatus.PROCESSING);
  });

  it('returns null for unknown states instead of guessing', () => {
    expect(normalizePayoutStatus('unknown')).toBeNull();
  });

  it('keeps ACCEPTED in flight and never treats it as success or debit evidence', () => {
    expect(normalizePayoutStatus('ACCEPTED')).toBe(TransactionStatus.PROCESSING);
    expect(isPayoutPendingStatus('ACCEPTED')).toBe(true);
    expect(isPayoutSuccessStatus('ACCEPTED')).toBe(false);
  });

  it('keeps the success, pending and failed sets disjoint', () => {
    for (const status of ['SUCCESS', 'PENDING', 'FAILED', 'REVERSED', 'SETTLED']) {
      const hits = [
        isPayoutSuccessStatus(status),
        isPayoutPendingStatus(status),
        isPayoutFailedStatus(status),
      ].filter(Boolean);
      expect(hits).toHaveLength(1);
    }
  });
});
