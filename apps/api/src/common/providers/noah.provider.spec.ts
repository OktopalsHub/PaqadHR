import { PaymentProvider } from '../enums/payment-provider.enum';
import { resolvePaymentProvider } from '../utils/resolve-payment-provider.util';
import { NoahProvider } from './noah.provider';

describe('NoahProvider', () => {
  const noahApi = {
    createCryptoPayout: jest.fn(),
    createFiatPayout: jest.fn(),
  };

  const provider = new NoahProvider(noahApi as never);

  beforeEach(() => {
    process.env.NOAH_API_KEY = 'test-key';
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.NOAH_API_KEY;
  });

  it('creates crypto payout for USDC payroll', async () => {
    noahApi.createCryptoPayout.mockResolvedValue({
      status: 'success',
      transactionId: 'txn-crypto-1',
    });

    const result = await provider.createPayment({
      amount: 100,
      currency: 'USDC',
      accountNumber: '0xabc',
      metadata: { payrollItemId: 'item-1' },
      description: 'Payroll',
    });

    expect(result.success).toBe(true);
    expect(noahApi.createCryptoPayout).toHaveBeenCalledWith(
      expect.objectContaining({
        cryptoCurrency: 'USDC',
        walletAddress: '0xabc',
      }),
    );
    expect(resolvePaymentProvider('USDC')).toBe(PaymentProvider.NOAH);
  });

  it('creates crypto payout for USDT payroll', async () => {
    noahApi.createCryptoPayout.mockResolvedValue({
      status: 'Pending',
      transactionId: 'txn-usdt-1',
    });

    const result = await provider.createPayment({
      amount: 40,
      currency: 'USDT',
      accountNumber: 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf',
      network: 'TRON',
      description: 'Payroll',
    });

    expect(result.success).toBe(true);
    expect(noahApi.createCryptoPayout).toHaveBeenCalledWith(
      expect.objectContaining({
        cryptoCurrency: 'USDT',
        walletAddress: 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf',
        network: 'TRON',
      }),
    );
  });

  it('creates crypto payout for ETH payroll', async () => {
    noahApi.createCryptoPayout.mockResolvedValue({
      status: 'Pending',
      transactionId: 'txn-eth-1',
    });

    const result = await provider.createPayment({
      amount: 0.01,
      currency: 'ETH',
      accountNumber: '0xabc',
      network: 'Ethereum',
      accountName: 'Payroll Recipient',
      description: 'Payroll',
    });

    expect(result.success).toBe(true);
    expect(noahApi.createCryptoPayout).toHaveBeenCalledWith(
      expect.objectContaining({
        cryptoCurrency: 'ETH',
        walletAddress: '0xabc',
        network: 'Ethereum',
      }),
    );
  });

  it('creates fiat payout for USD payroll', async () => {
    noahApi.createFiatPayout.mockResolvedValue({
      status: 'Pending',
      transactionId: 'txn-usd-1',
    });

    const result = await provider.createPayment({
      amount: 200,
      currency: 'USD',
      accountNumber: '123456789',
      accountName: 'John Doe',
      bankCode: '021000021',
      bankName: 'Chase Bank',
      description: 'Payroll',
    });

    expect(result.success).toBe(true);
    expect(noahApi.createFiatPayout).toHaveBeenCalledWith(
      expect.objectContaining({
        fiatCurrency: 'USD',
        countryCode: 'US',
        accountNumber: '123456789',
      }),
    );
  });

  it('creates fiat payout for EUR payroll', async () => {
    noahApi.createFiatPayout.mockResolvedValue({
      status: 'Pending',
      transactionId: 'txn-eur-1',
    });

    const result = await provider.createPayment({
      amount: 150,
      currency: 'EUR',
      accountNumber: 'DE89370400440532013000',
      accountName: 'Jane Smith',
      bankCode: 'COBADEFF',
      description: 'Payroll',
    });

    expect(result.success).toBe(true);
    expect(noahApi.createFiatPayout).toHaveBeenCalledWith(
      expect.objectContaining({
        fiatCurrency: 'EUR',
        countryCode: 'DE',
        accountNumber: 'DE89370400440532013000',
      }),
    );
  });

  it('returns error when crypto wallet address is missing', async () => {
    const result = await provider.createPayment({
      amount: 50,
      currency: 'USDC',
      description: 'Payroll',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('wallet address');
  });
});
