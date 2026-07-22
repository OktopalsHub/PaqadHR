export interface PaymentResult {
  success: boolean;
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
