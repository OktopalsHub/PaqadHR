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
    process.env.FINCRA_API_KEY = 'secret';
    process.env.FINCRA_PUBLIC_KEY = 'pub';
    process.env.FINCRA_BUSINESS_ID = 'biz';
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.FINCRA_API_KEY;
    delete process.env.FINCRA_PUBLIC_KEY;
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

  it('creates EUR bank payout with SWIFT', async () => {
    fincraApi.initiatePayout.mockResolvedValue({
      success: true,
      reference: 'fincra-eur-1',
      status: 'processing',
    });
    fincraApi.isOperationPending.mockReturnValue(true);

    const result = await provider.createPayment({
      amount: 100,
      currency: 'EUR',
      accountNumber: 'DE89370400440532013000',
      accountName: 'Jane Smith',
      bankCode: 'COBADEFF',
      merchantTxRef: 'payroll_eur_item',
      description: 'Payroll',
    });

    expect(result.success).toBe(true);
    expect(fincraApi.initiatePayout).toHaveBeenCalledWith(
      expect.objectContaining({
        destinationCurrency: 'EUR',
        bankSwiftCode: 'COBADEFF',
        accountNumber: 'DE89370400440532013000',
      }),
    );
  });

  it('creates USD bank payout with bank code and name', async () => {
    fincraApi.initiatePayout.mockResolvedValue({
      success: true,
      reference: 'fincra-usd-1',
      status: 'processing',
    });
    fincraApi.isOperationPending.mockReturnValue(true);

    const result = await provider.createPayment({
      amount: 50,
      currency: 'USD',
      accountNumber: '123456789',
      accountName: 'John Doe USD Test',
      bankCode: '021000021',
      bankName: 'Chase Bank',
      merchantTxRef: 'payroll_usd_item',
      description: 'Payroll',
    });

    expect(result.success).toBe(true);
    expect(fincraApi.initiatePayout).toHaveBeenCalledWith(
      expect.objectContaining({
        destinationCurrency: 'USD',
        bankCode: '021000021',
        bankName: 'Chase Bank',
      }),
    );
  });

  it('creates GBP bank payout with sort code', async () => {
    fincraApi.initiatePayout.mockResolvedValue({
      success: true,
      reference: 'fincra-gbp-1',
      status: 'processing',
    });
    fincraApi.isOperationPending.mockReturnValue(true);

    const result = await provider.createPayment({
      amount: 80,
      currency: 'GBP',
      accountNumber: 'GB29NWBK60161331926819',
      accountName: 'John Doe',
      bankCode: '601613',
      merchantTxRef: 'payroll_gbp_item',
      description: 'Payroll',
    });

    expect(result.success).toBe(true);
    expect(fincraApi.initiatePayout).toHaveBeenCalledWith(
      expect.objectContaining({
        destinationCurrency: 'GBP',
        sortCode: '601613',
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

  it('creates USDT crypto payout when network is provided', async () => {
    fincraApi.initiatePayout.mockResolvedValue({
      success: true,
      reference: 'fincra-usdt-1',
      status: 'processing',
    });
    fincraApi.isOperationPending.mockReturnValue(true);

    const result = await provider.createPayment({
      amount: 25,
      currency: 'USDT',
      accountNumber: 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf',
      network: 'TRC20',
      merchantTxRef: 'payroll_usdt_item',
      description: 'Payroll',
    });

    expect(result.success).toBe(true);
    expect(fincraApi.initiatePayout).toHaveBeenCalledWith(
      expect.objectContaining({
        destinationCurrency: 'USDT',
        walletAddress: 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf',
        cryptoNetwork: 'TRC20',
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
