import type { CreatePaymentData } from '../interfaces/create-payment-data.interface';
import { MonnifyProvider } from './monnify.provider';

describe('MonnifyProvider.createBulkTransfer', () => {
  const originalApiKey = process.env.MONNIFY_API_KEY;
  const originalSecret = process.env.MONNIFY_SECRET_KEY;
  const originalContract = process.env.MONNIFY_CONTRACT_CODE;

  afterEach(() => {
    process.env.MONNIFY_API_KEY = originalApiKey;
    process.env.MONNIFY_SECRET_KEY = originalSecret;
    process.env.MONNIFY_CONTRACT_CODE = originalContract;
    jest.restoreAllMocks();
  });

  it('builds one batchTransfer call with per-line payroll merchant refs', async () => {
    process.env.MONNIFY_API_KEY = 'key';
    process.env.MONNIFY_SECRET_KEY = 'secret';
    process.env.MONNIFY_CONTRACT_CODE = 'contract';

    const batchTransfer = jest.fn().mockResolvedValue([
      { success: true, reference: 'payroll_run_itemA', status: 'SUCCESS' },
      { success: false, reference: 'payroll_run_itemB', status: 'PENDING', message: 'queued' },
    ]);
    const monnifyApi = { batchTransfer } as never;
    const provider = new MonnifyProvider(monnifyApi);

    const transfers: CreatePaymentData[] = [
      {
        amount: 1000,
        currency: 'NGN',
        description: 'Payroll A',
        accountNumber: '111',
        accountName: 'Ada',
        bankCode: '058',
        bankName: 'GTBank',
        merchantTxRef: 'payroll_run_itemA',
      },
      {
        amount: 2000,
        currency: 'NGN',
        description: 'Payroll B',
        accountNumber: '222',
        accountName: 'Grace',
        bankCode: '058',
        bankName: 'GTBank',
        merchantTxRef: 'payroll_run_itemB',
      },
    ];

    const results = await provider.createBulkTransfer(transfers);

    expect(batchTransfer).toHaveBeenCalledTimes(1);
    const payload = batchTransfer.mock.calls[0][0];
    expect(payload.transactions).toHaveLength(2);
    expect(payload.transactions[0].reference).toBe('payroll_run_itemA');
    expect(payload.transactions[1].reference).toBe('payroll_run_itemB');
    expect(payload.transactions[0].amount).toBe(1000);
    expect(payload.transactions[1].amount).toBe(2000);
    expect(results).toHaveLength(2);
    expect(results[0].reference).toBe('payroll_run_itemA');
    expect(results[0].success).toBe(true);
    expect(results[1].reference).toBe('payroll_run_itemB');
    expect(results[1].success).toBe(false);
    expect(results[1].retryable).toBe(true);
  });
});
