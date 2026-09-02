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
