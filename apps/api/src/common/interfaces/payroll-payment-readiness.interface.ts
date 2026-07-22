export const PayrollPaymentIssue = {
  MISSING_PAYMENT_METHOD: 'missing_payment_method',
  UNVERIFIED_PAYMENT_METHOD: 'unverified_payment_method',
  LOCKED_PAYMENT_METHOD: 'locked_payment_method',
  INCOMPLETE_BANK_DETAILS: 'incomplete_bank_details',
  INCOMPLETE_WALLET_DETAILS: 'incomplete_wallet_details',
  PAYMENT_RAIL_MISMATCH: 'payment_rail_mismatch',
  CURRENCY_MISMATCH: 'currency_mismatch',
  UNSUPPORTED_CURRENCY: 'unsupported_currency',
  EXCLUDED_FROM_RUN: 'excluded_from_run',
} as const;


export type PayrollPaymentIssue = (typeof PayrollPaymentIssue)[keyof typeof PayrollPaymentIssue];

export interface PayrollPaymentReadiness {
  memberId: string;
  ready: boolean;
  issues: PayrollPaymentIssue[];
  message: string;
  paymentMethodId?: string;
  currency?: string;
}
