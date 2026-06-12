export class PaymentProviderError extends Error {
  constructor(
    message: string,
    public code: string,
    public retryable: boolean = false,
    public originalError?: unknown,
  ) {
    super(message);
    this.name = 'PaymentProviderError';
  }
}
