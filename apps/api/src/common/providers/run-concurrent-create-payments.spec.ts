import type { CreatePaymentData } from '../interfaces/create-payment-data.interface';
import type { PaymentResult } from '../interfaces/payment-result.interface';
import { runConcurrentCreatePayments } from './run-concurrent-create-payments';

describe('runConcurrentCreatePayments', () => {
  it('preserves input order and maps partial failures by index', async () => {
    const transfers = [
      { merchantTxRef: 'ref-a', amount: 1, currency: 'NGN', description: 'a' },
      { merchantTxRef: 'ref-b', amount: 2, currency: 'NGN', description: 'b' },
      { merchantTxRef: 'ref-c', amount: 3, currency: 'NGN', description: 'c' },
    ] as CreatePaymentData[];

    const createPayment = jest
      .fn()
      .mockImplementation(async (data: CreatePaymentData): Promise<PaymentResult> => {
        if (data.merchantTxRef === 'ref-b') {
          return {
            success: false,
            error: 'declined',
            reference: data.merchantTxRef,
          };
        }
        await new Promise((resolve) => setTimeout(resolve, data.merchantTxRef === 'ref-c' ? 5 : 1));
        return {
          success: true,
          transactionId: `txn-${data.merchantTxRef}`,
          reference: data.merchantTxRef,
        };
      });

    const results = await runConcurrentCreatePayments(createPayment, transfers, 2);

    expect(results).toHaveLength(3);
    expect(results[0].reference).toBe('ref-a');
    expect(results[0].success).toBe(true);
    expect(results[1].reference).toBe('ref-b');
    expect(results[1].success).toBe(false);
    expect(results[2].reference).toBe('ref-c');
    expect(results[2].success).toBe(true);
    expect(createPayment).toHaveBeenCalledTimes(3);
  });

  it('returns empty array for empty input', async () => {
    const createPayment = jest.fn();
    await expect(runConcurrentCreatePayments(createPayment, [])).resolves.toEqual([]);
    expect(createPayment).not.toHaveBeenCalled();
  });

  it('keeps sibling successes when one createPayment rejects', async () => {
    const transfers = [
      { merchantTxRef: 'ref-a', amount: 1, currency: 'NGN', description: 'a' },
      { merchantTxRef: 'ref-b', amount: 2, currency: 'NGN', description: 'b' },
      { merchantTxRef: 'ref-c', amount: 3, currency: 'NGN', description: 'c' },
    ] as CreatePaymentData[];

    const createPayment = jest
      .fn()
      .mockImplementation(async (data: CreatePaymentData): Promise<PaymentResult> => {
        if (data.merchantTxRef === 'ref-b') {
          throw new Error('provider blew up');
        }
        return {
          success: true,
          transactionId: `txn-${data.merchantTxRef}`,
          reference: data.merchantTxRef,
        };
      });

    const results = await runConcurrentCreatePayments(createPayment, transfers, 2);

    expect(results).toHaveLength(3);
    expect(results[0].success).toBe(true);
    expect(results[0].reference).toBe('ref-a');
    expect(results[1].success).toBe(false);
    expect(results[1].retryable).toBe(true);
    expect(results[1].error).toContain('provider blew up');
    expect(results[1].reference).toBe('ref-b');
    expect(results[2].success).toBe(true);
    expect(results[2].reference).toBe('ref-c');
  });
});
