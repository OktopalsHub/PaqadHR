import { FincraProvider } from './fincra.provider';

describe('FincraProvider', () => {
  const fincraApi = {
    initiatePayout: jest.fn(),
    verifyWebhookSignature: jest.fn(),
    getPayoutStatus: jest.fn(),
    isOperationPending: jest.fn(),
  };

  const provider = new FincraProvider(fincraApi as never);

  beforeEach(() => {
    process.env.FINCRA_API_KEY = 'key';
    process.env.FINCRA_BUSINESS_ID = 'biz';
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.FINCRA_API_KEY;
    delete process.env.FINCRA_BUSINESS_ID;
  });

  it('creates NGN bank payout', async () => {
    fincraApi.initiatePayout.mockResolvedValue({
      success: true,
      reference: 'fincra-ref-1',
      status: 'processing',
    });

    const result = await provider.createPayment({
      amount: 5000,
      currency: 'NGN',
      accountNumber: '0123456789',
      accountName: 'Jane Doe',
      bankCode: '044',
      merchantTxRef: 'payroll_run_item',
      description: 'Payroll',
    });

    expect(result.success).toBe(true);
    expect(fincraApi.initiatePayout).toHaveBeenCalledWith(
      expect.objectContaining({
        destinationCurrency: 'NGN',
        customerReference: 'payroll_run_item',
      }),
    );
  });

  it('creates USDC crypto payout when network is provided', async () => {
    fincraApi.initiatePayout.mockResolvedValue({
      success: true,
      reference: 'fincra-ref-2',
      status: 'processing',
    });
    fincraApi.isOperationPending.mockReturnValue(true);

    const result = await provider.createPayment({
      amount: 100,
      currency: 'USDC',
      accountNumber: '0xabc',
      metadata: { cryptoNetwork: 'ERC20' },
      merchantTxRef: 'payroll_crypto_item',
      description: 'Payroll',
    });

    expect(result.success).toBe(true);
    expect(fincraApi.initiatePayout).toHaveBeenCalledWith(
      expect.objectContaining({
        destinationCurrency: 'USDC',
        walletAddress: '0xabc',
        cryptoNetwork: 'ERC20',
      }),
    );
  });

  it('requires crypto network for USDC payout', async () => {
    const result = await provider.createPayment({
      amount: 100,
      currency: 'USDC',
      accountNumber: '0xabc',
      merchantTxRef: 'payroll_crypto_item',
      description: 'Payroll',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Crypto network is required');
    expect(fincraApi.initiatePayout).not.toHaveBeenCalled();
  });
});
