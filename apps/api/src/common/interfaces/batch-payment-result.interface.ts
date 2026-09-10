import type { PaymentResult } from './payment-result.interface';

export interface BatchPaymentResult {
  totalItems: number;
  successfulPayments: number;
  failedPayments: number;
  /** Accepted by provider, awaiting webhook / settlement confirmation */
  processingPayments: number;
  /** @deprecated Use payoutResults — kept for older clients */
  fiatResults: PaymentResult[];
  payoutResults: PaymentResult[];
  summary: {
    bankSuccess: number;
    bankFailed: number;
    bankProcessing: number;
    cryptoSuccess: number;
    cryptoFailed: number;
    cryptoProcessing: number;
    /** @deprecated alias of bankSuccess + cryptoSuccess breakdown */
    fiatSuccess: number;
    fiatFailed: number;
  };
}
