export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  reference?: string;
  checkoutUrl?: string;
  qrCode?: string;
  walletAddress?: string;
  networkFee?: number;
  estimatedConfirmationTime?: number;
  error?: string;
  errorCode?: string;
  retryable?: boolean;
}

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  error?: string;
  provider?: string;
}
