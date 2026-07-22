import type { PaymentResult } from './payment-result.interface';

export interface BatchPaymentResult {
  totalItems: number;
  successfulPayments: number;
  failedPayments: number;
  /** @deprecated Use payoutResults — kept for older clients */
  fiatResults: PaymentResult[];
  payoutResults: PaymentResult[];
  summary: {
    bankSuccess: number;
    bankFailed: number;
    cryptoSuccess: number;
    cryptoFailed: number;
    /** @deprecated alias of bankSuccess + cryptoSuccess breakdown */
    fiatSuccess: number;
    fiatFailed: number;
  };
}
