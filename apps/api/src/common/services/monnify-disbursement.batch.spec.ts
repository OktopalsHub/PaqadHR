import { MonnifyDisbursementService } from './monnify-disbursement.service';

describe('MonnifyDisbursementService.batchTransfer', () => {
  it('marks omitted transaction lines as non-success PENDING', async () => {
    process.env.MONNIFY_WALLET_ACCOUNT_NUMBER = '0123456789';

    const monnifyFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        requestSuccessful: true,
        responseBody: {
          status: 'SUCCESS',
          transactionList: [{ reference: 'payroll_run_itemA', status: 'SUCCESS' }],
        },
      }),
    });
    const auth = {
      ensureConfigured: jest.fn(),
      getAccessToken: jest.fn().mockResolvedValue('token'),
      monnifyFetch,
    };
    const service = new MonnifyDisbursementService(auth as never);

    const results = await service.batchTransfer({
      title: 'Payroll',
      batchReference: 'batch_1',
      narration: 'Payroll',
      transactions: [
        {
          amount: 1000,
          reference: 'payroll_run_itemA',
          narration: 'A',
          destinationBankCode: '058',
          destinationAccountNumber: '111',
          destinationAccountName: 'Ada',
        },
        {
          amount: 2000,
          reference: 'payroll_run_itemB',
          narration: 'B',
          destinationBankCode: '058',
          destinationAccountNumber: '222',
          destinationAccountName: 'Grace',
        },
      ],
    });

    expect(results[0]).toEqual(
      expect.objectContaining({
        success: true,
        reference: 'payroll_run_itemA',
        status: 'SUCCESS',
      }),
    );
    expect(results[1]).toEqual(
      expect.objectContaining({
        success: false,
        reference: 'payroll_run_itemB',
        status: 'PENDING',
      }),
    );
  });
});
