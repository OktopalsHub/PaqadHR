import type { PaymentProvider } from '../enums/payment-provider.enum';

export interface PayoutStatusResult {
  status: string;
  amount?: number;
  reference?: string;
}

export interface PayoutStatusQuerier {
  readonly provider: PaymentProvider;
  queryStatus(transactionId: string, merchantRef?: string): Promise<PayoutStatusResult | null>;
}
