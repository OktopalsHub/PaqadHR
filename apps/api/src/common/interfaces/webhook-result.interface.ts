import type { TransactionStatus } from '../enums/transaction-status.enum';

export interface WebhookResult {
  success: boolean;
  transactionId?: string;
  status?: TransactionStatus;
  amount?: number;
  currency?: string;
  fees?: number;
  networkFee?: number;
  confirmations?: number;
  blockHash?: string;
  error?: string;
  errorCode?: string;
}
