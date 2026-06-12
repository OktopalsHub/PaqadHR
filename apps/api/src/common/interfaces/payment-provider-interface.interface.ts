import { BulkTransferData } from './bulk-transfer-data.interface';
import { CreatePaymentData } from './create-payment-data.interface';
import { PaymentResult } from './payment-result.interface';
import { TransactionStatus } from '../enums/transaction-status.enum';
import { WebhookResult } from './webhook-result.interface';

export interface PaymentProviderInterface {
  createPayment(data: CreatePaymentData): Promise<PaymentResult>;
  processWebhook(payload: unknown, signature: string): Promise<WebhookResult>;
  getSupportedCurrencies(): Promise<string[]>;
  validateSignature(payload: unknown, signature: string): boolean;
  validateCurrency(currency: string): Promise<boolean>;
  formatAmount(amount: number, currency: string): number;
  getTransactionStatus(transactionId: string): Promise<TransactionStatus>;
  createBulkTransfer?(transfers: BulkTransferData[]): Promise<PaymentResult>;
  getExchangeRate?(fromCurrency: string, toCurrency: string): Promise<number>;
  validateWalletAddress?(address: string, currency: string): Promise<boolean>;
  getNetworkFee?(currency: string, network?: string): Promise<number>;
  isHealthy(): Promise<boolean>;
}
