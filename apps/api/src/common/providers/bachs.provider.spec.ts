import { BachsApiError } from '../services/bachs-api.service';
import { BachsProvider } from './bachs.provider';

describe('BachsProvider', () => {
  const ORIGINAL_ENV = { ...process.env };

  const makeApi = () => ({
    createPayoutDestination: jest.fn().mockResolvedValue({
      id: 'pd_dest1',
      status: 'approved',
      is_usable: true,
      account_name: 'ADA OKAFOR',
    }),
    createPayoutQuote: jest.fn().mockResolvedValue({ quote_id: 'qt_1' }),
    createPayout: jest.fn().mockResolvedValue({ id: 'pay_1', status: 'pending', currency: 'NGN' }),
    getPayout: jest.fn(),
  });

  let bachsApi: ReturnType<typeof makeApi>;
  let provider: BachsProvider;

  const ngnData = {
    amount: 300000,
    currency: 'NGN',
    description: 'Payroll',
    accountNumber: '0123456789',
    bankCode: '058',
    merchantTxRef: 'pi_abc',
    metadata: { payrollItemId: 'item-1' },
  };

  beforeEach(() => {
    process.env.BACHS_SECRET_KEY = 'sk_sandbox_test';
    delete process.env.BACHS_PAYOUT_SOURCE_CURRENCY;
    bachsApi = makeApi();
    provider = new BachsProvider(bachsApi as never);
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    jest.restoreAllMocks();
  });

  it('uses a lower concurrency for bulk payouts', async () => {
    let activePayouts = 0;
    let maxConcurrency = 0;
    const resolvers: Array<() => void> = [];

    const createPayment = jest.spyOn(provider, 'createPayment').mockImplementation(async (data) => {
      activePayouts += 1;
      maxConcurrency = Math.max(maxConcurrency, activePayouts);

      await new Promise<void>((resolve) => resolvers.push(resolve));
      activePayouts -= 1;

      return { success: true, reference: data.merchantTxRef, outcome: 'processing' };
    });

    const transfers = Array.from({ length: 6 }, (_, index) => ({
      ...ngnData,
      merchantTxRef: `bulk-${index}`,
    }));

    const resultPromise = provider.createBulkTransfer(transfers as never);

    expect(createPayment).toHaveBeenCalledTimes(5);
    expect(maxConcurrency).toBe(5);

    resolvers.splice(0, 5).forEach((resolve) => resolve());

    expect(resolvers).toHaveLength(6);
    resolvers[5]();

    const result = await resultPromise;

    expect(result).toHaveLength(6);
    expect(createPayment).toHaveBeenCalledTimes(6);
  });

  it('pays an NGN payroll item through a bank destination with idempotency and reference', async () => {
    const result = await provider.createPayment(ngnData as never);

    expect(bachsApi.createPayoutDestination).toHaveBeenCalledWith({
      currency: 'NGN',
      accountNumber: '0123456789',
      bankCode: '058',
    });
    expect(bachsApi.createPayout).toHaveBeenCalledWith({
      destination: 'pd_dest1',
      amount: '300000.00',
      quoteId: undefined,
      reference: 'pi_abc',
      idempotencyKey: 'pi_abc',
    });
    expect(result.success).toBe(true);
    expect(result.outcome).toBe('processing');
    expect(result.transactionId).toBe('pay_1');
    expect(result.providerStatus).toBe('pending');
    expect(result.rail).toBe('bank');
  });

  it('reuses a persisted destination id without resolving the bank account again', async () => {
    const result = await provider.createPayment({
      ...ngnData,
      metadata: { payrollItemId: 'item-1', bachsDestinationId: 'pd_persisted' },
    } as never);

    expect(bachsApi.createPayoutDestination).not.toHaveBeenCalled();
    expect(bachsApi.createPayout).toHaveBeenCalledWith({
      destination: 'pd_persisted',
      amount: '300000.00',
      quoteId: undefined,
      reference: 'pi_abc',
      idempotencyKey: 'pi_abc',
    });
    expect(result.metadata).toEqual({ bachsDestinationId: 'pd_persisted' });
  });

  it('reuses a cached destination for repeat payouts', async () => {
    await provider.createPayment(ngnData as never);
    await provider.createPayment(ngnData as never);

    expect(bachsApi.createPayoutDestination).toHaveBeenCalledTimes(1);
    expect(bachsApi.createPayout).toHaveBeenCalledTimes(2);
  });

  it('maps a USDT TRC20 wallet to a USDT_TRC20 destination', async () => {
    const result = await provider.createPayment({
      amount: 100,
      currency: 'USDT',
      description: 'Payroll',
      merchantTxRef: 'pi_usdt',
      metadata: { payrollItemId: 'item-2', walletAddress: 'TWd4WrZ9wn84f5x1hZhL4DHvk738ns5jwb' },
      network: 'TRC20',
    } as never);

    expect(bachsApi.createPayoutDestination).toHaveBeenCalledWith({
      currency: 'USDT_TRC20',
      walletAddress: 'TWd4WrZ9wn84f5x1hZhL4DHvk738ns5jwb',
      network: 'TRC20',
    });
    expect(result.success).toBe(true);
    expect(result.rail).toBe('crypto');
  });

  it('rejects USDT payouts on networks Bachs does not deliver', async () => {
    const result = await provider.createPayment({
      amount: 100,
      currency: 'USDT',
      description: 'Payroll',
      metadata: { walletAddress: '0xabc', cryptoNetwork: 'Ethereum' },
    } as never);

    expect(result.success).toBe(false);
    expect(result.retryable).toBe(false);
    expect(bachsApi.createPayoutDestination).not.toHaveBeenCalled();
  });

  it('rejects fiat currencies Bachs cannot deliver to bank accounts', async () => {
    const result = await provider.createPayment({
      amount: 500,
      currency: 'USD',
      description: 'Payroll',
      accountNumber: '84419915',
      bankCode: '026',
    } as never);

    expect(result.success).toBe(false);
    expect(result.retryable).toBe(false);
    expect(bachsApi.createPayout).not.toHaveBeenCalled();
  });

  it('quotes a cross-currency USD→NGN payout from the salary amount', async () => {
    process.env.BACHS_PAYOUT_SOURCE_CURRENCY = 'USD';
    const result = await provider.createPayment({
      ...ngnData,
      metadata: {
        payrollItemId: 'item-1',
        fxAtPayout: true,
        salaryCurrency: 'USD',
      },
    } as never);

    expect(bachsApi.createPayoutQuote).toHaveBeenCalledWith({
      fromCurrency: 'USD',
      toCurrency: 'NGN',
      amount: '300000.00',
    });
    expect(bachsApi.createPayout).toHaveBeenCalledWith({
      destination: 'pd_dest1',
      amount: undefined,
      quoteId: 'qt_1',
      reference: 'pi_abc',
      idempotencyKey: 'pi_abc',
    });
    expect(result.success).toBe(true);
  });

  it('fails closed when a foreign source balance cannot fund a pre-converted amount', async () => {
    process.env.BACHS_PAYOUT_SOURCE_CURRENCY = 'USD';
    const result = await provider.createPayment(ngnData as never);

    expect(result.success).toBe(false);
    expect(result.retryable).toBe(false);
    expect(bachsApi.createPayoutQuote).not.toHaveBeenCalled();
    expect(bachsApi.createPayout).not.toHaveBeenCalled();
  });

  it('quotes a USD→USDT payout at disbursement without any source-currency env', async () => {
    const result = await provider.createPayment({
      amount: 1000,
      currency: 'USDT',
      description: 'Payroll',
      merchantTxRef: 'pi_usd',
      network: 'TRC20',
      metadata: {
        payrollItemId: 'item-3',
        walletAddress: 'TWd4WrZ9wn84f5x1hZhL4DHvk738ns5jwb',
        fxAtPayout: true,
        salaryCurrency: 'USD',
      },
    } as never);

    expect(bachsApi.createPayoutQuote).toHaveBeenCalledWith({
      fromCurrency: 'USD',
      toCurrency: 'USDT_TRC20',
      amount: '1000.00',
    });
    expect(bachsApi.createPayout).toHaveBeenCalledWith({
      destination: 'pd_dest1',
      amount: undefined,
      quoteId: 'qt_1',
      reference: 'pi_usd',
      idempotencyKey: 'pi_usd',
    });
    expect(result.success).toBe(true);
    expect(result.rail).toBe('crypto');
  });

  it('pays a USDT salary to a TRC20 wallet without a quote (same asset)', async () => {
    const result = await provider.createPayment({
      amount: 250,
      currency: 'USDT',
      description: 'Payroll',
      merchantTxRef: 'pi_usdt_salary',
      network: 'TRC20',
      metadata: {
        payrollItemId: 'item-4',
        walletAddress: 'TWd4WrZ9wn84f5x1hZhL4DHvk738ns5jwb',
        fxAtPayout: true,
        salaryCurrency: 'USDT',
      },
    } as never);

    expect(bachsApi.createPayoutQuote).not.toHaveBeenCalled();
    expect(bachsApi.createPayout).toHaveBeenCalledWith({
      destination: 'pd_dest1',
      amount: '250.00',
      quoteId: undefined,
      reference: 'pi_usdt_salary',
      idempotencyKey: 'pi_usdt_salary',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a declared source currency that cannot match the item amount', async () => {
    // The amount is pre-converted to NGN, so a USD-declared balance cannot fund it.
    const result = await provider.createPayment({
      ...ngnData,
      metadata: { payrollItemId: 'item-1', bachsSourceCurrency: 'USD' },
    } as never);

    expect(result.success).toBe(false);
    expect(result.retryable).toBe(false);
    expect(bachsApi.createPayout).not.toHaveBeenCalled();
  });

  it('classifies a synchronously failed payout as terminal', async () => {
    bachsApi.createPayout.mockResolvedValue({
      id: 'pay_2',
      status: 'failed',
      failure_reason: 'Bank rejected the transfer',
    });
    const result = await provider.createPayment(ngnData as never);

    expect(result.success).toBe(false);
    expect(result.outcome).toBe('failed');
    expect(result.retryable).toBe(false);
    expect(result.providerStatus).toBe('failed');
  });

  it('marks insufficient balance as non-retryable', async () => {
    bachsApi.createPayout.mockRejectedValue(
      new BachsApiError('Balance too low', 'INSUFFICIENT_BALANCE', 400),
    );
    const result = await provider.createPayment(ngnData as never);

    expect(result.success).toBe(false);
    expect(result.retryable).toBe(false);
  });

  it('retries transient server errors', async () => {
    bachsApi.createPayout.mockRejectedValue(
      new BachsApiError('Unexpected error', 'INTERNAL_SERVER_ERROR', 500),
    );
    const result = await provider.createPayment(ngnData as never);

    expect(result.success).toBe(false);
    expect(result.retryable).toBe(true);
  });

  it('treats an unusable destination as non-retryable', async () => {
    bachsApi.createPayoutDestination.mockResolvedValue({
      id: 'pd_dest2',
      status: 'pending_review',
      is_usable: false,
    });
    const result = await provider.createPayment(ngnData as never);

    expect(result.success).toBe(false);
    expect(result.retryable).toBe(false);
  });

  it('returns not-configured without touching the API', async () => {
    process.env.BACHS_SECRET_KEY = '';
    const result = await provider.createPayment(ngnData as never);

    expect(result.success).toBe(false);
    expect(result.retryable).toBe(false);
    expect(bachsApi.createPayout).not.toHaveBeenCalled();
  });
});
