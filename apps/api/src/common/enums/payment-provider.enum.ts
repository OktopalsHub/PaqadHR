export enum TransactionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}
export enum TransactionType {
  DEPOSIT = 'deposit',
  WITHDRAWAL = 'withdrawal',
  PAYROLL = 'payroll',
  FEE = 'fee',
  REFUND = 'refund',
}
export enum PaymentProvider {
  NOMBA = 'nomba',
  MONNIFY = 'monnify',
  NOAH = 'noah',
}
