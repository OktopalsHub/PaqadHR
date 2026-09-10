import type { CreatePaymentData } from '../interfaces/create-payment-data.interface';
import type { PaymentResult } from '../interfaces/payment-result.interface';

/**
 * Run createPayment for many transfers with a concurrency limit (not sequential).
 * Each result.reference is set to the input merchantTxRef when missing.
 */
export async function runConcurrentCreatePayments(
  createPayment: (data: CreatePaymentData) => Promise<PaymentResult>,
  transfers: CreatePaymentData[],
  concurrency = 10,
): Promise<PaymentResult[]> {
  if (transfers.length === 0) return [];
  const limit = Math.max(1, concurrency);
  const results: PaymentResult[] = new Array(transfers.length);
  let nextIndex = 0;

  const workers = Array.from({ length: Math.min(limit, transfers.length) }, async () => {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= transfers.length) return;
      const transfer = transfers[index];
      try {
        const result = await createPayment(transfer);
        results[index] = {
          ...result,
          reference: result.reference ?? transfer.merchantTxRef,
        };
      } catch (error) {
        results[index] = {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          retryable: true,
          reference: transfer.merchantTxRef,
        };
      }
    }
  });

  await Promise.all(workers);
  return results;
}
