import type { TransactionStatus } from '../enums/transaction-status.enum';
import type { CreatePaymentData } from './create-payment-data.interface';
import type { PaymentResult } from './payment-result.interface';
import type { WebhookResult } from './webhook-result.interface';

export interface PaymentProviderInterface {
  createPayment(data: CreatePaymentData): Promise<PaymentResult>;
  /** Pay many recipients at once. Each result.reference must match input merchantTxRef. */
  createBulkTransfer(transfers: CreatePaymentData[]): Promise<PaymentResult[]>;
  processWebhook(payload: unknown, signature: string): Promise<WebhookResult>;
  getSupportedCurrencies(): Promise<string[]>;
  validateSignature(payload: unknown, signature: string): boolean;
  validateCurrency(currency: string): Promise<boolean>;
  formatAmount(amount: number, currency: string): number;
  getTransactionStatus(transactionId: string): Promise<TransactionStatus>;
  getExchangeRate?(fromCurrency: string, toCurrency: string): Promise<number>;
  validateWalletAddress?(address: string, currency: string): Promise<boolean>;
  getNetworkFee?(currency: string, network?: string): Promise<number>;
  isHealthy(): Promise<boolean>;
}
