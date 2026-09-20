import { PaymentProvider, TransactionStatus } from '../enums/payment-provider.enum';
import { normalizePayoutStatus } from './normalize-payout-status.util';

describe('normalizePayoutStatus', () => {
  it('normalizes Noah terminal states', () => {
    expect(normalizePayoutStatus(PaymentProvider.NOAH, 'Settled')).toBe(TransactionStatus.COMPLETED);
    expect(normalizePayoutStatus(PaymentProvider.NOAH, 'Failed')).toBe(TransactionStatus.FAILED);
  });

  it('normalizes Bachs terminal states', () => {
    expect(normalizePayoutStatus(PaymentProvider.BACHS, 'successful')).toBe(TransactionStatus.COMPLETED);
    expect(normalizePayoutStatus(PaymentProvider.BACHS, 'reversed')).toBe(TransactionStatus.FAILED);
  });

  it('defaults unknown provider states to processing', () => {
    expect(normalizePayoutStatus(PaymentProvider.NOMBA, 'unknown')).toBe(TransactionStatus.PROCESSING);
  });
});
