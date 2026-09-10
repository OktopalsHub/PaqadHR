export type PaymentResultOutcome = 'paid' | 'processing' | 'failed';

export interface PaymentResult {
  success: boolean;
  /** Explicit payout outcome. Prefer this over inferring from `success` alone. */
  outcome?: PaymentResultOutcome;
  transactionId?: string;
  reference?: string;
  provider?: string;
  providerStatus?: string;
  checkoutUrl?: string;
  error?: string;
  errorCode?: string;
  retryable?: boolean;
  rail?: 'bank' | 'crypto';
}
