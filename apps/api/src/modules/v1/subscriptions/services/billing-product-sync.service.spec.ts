import { Logger } from '@nestjs/common';
import type { PlanPrice } from '../../plans/entities/plan-price.entity';
import { BachsProductSyncService } from './bachs-product-sync.service';
import { BillingProductSyncService } from './billing-product-sync.service';

describe('BachsProductSyncService currency_options', () => {
  const priceRepo = { find: jest.fn(), save: jest.fn(), count: jest.fn() };
  const service = new BachsProductSyncService(priceRepo as never);

  it('buildBachsCurrencyOptions maps sibling plan_prices row', () => {
    const usdRow = { monthlyPrice: 99, regionalConfig: null } as unknown as PlanPrice;
    const ngnRow = { monthlyPrice: 75000, regionalConfig: null } as unknown as PlanPrice;
    const bySlugCurrency = new Map([
      ['scale:USD', usdRow],
      ['scale:NGN', ngnRow],
    ]);

    const options = (service as any).buildBachsCurrencyOptions('scale', 'USD', bySlugCurrency);
    expect(options).toEqual({ NGN: '75000.00' });

    const reverse = (service as any).buildBachsCurrencyOptions('scale', 'NGN', bySlugCurrency);
    expect(reverse).toEqual({ USD: '99.00' });
  });

  it('syncBachsProductCurrencyOptions PATCHes currency_options on Bachs product', async () => {
    const bachsRequest = jest.spyOn(service as any, 'bachsRequest').mockResolvedValue({});

    await (service as any).syncBachsProductCurrencyOptions('prod_1', 'USD', 99, {
      NGN: '75000.00',
    });

    expect(bachsRequest).toHaveBeenCalledWith(
      '/v1/products/prod_1',
      expect.objectContaining({ method: 'PATCH' }),
    );
    const patchInit = bachsRequest.mock.calls[0][1] as { body: string };
    const body = JSON.parse(patchInit.body);
    expect(body.price).toEqual({
      price_type: 'fixed',
      currency: 'USD',
      amount: '99.00',
      currency_options: { NGN: '75000.00' },
    });
  });
});

describe('BillingProductSyncService startup self-heal', () => {
  const originalEnv = {
    BILLING_NG_PROVIDER: process.env.BILLING_NG_PROVIDER,
    BILLING_GLOBAL_PROVIDER: process.env.BILLING_GLOBAL_PROVIDER,
    BACHS_SECRET_KEY: process.env.BACHS_SECRET_KEY,
  };

  const buildService = (missing: number) => {
    const priceRepo = { count: jest.fn().mockResolvedValue(missing) };
    const bachsSync = { syncBachsProducts: jest.fn() };
    return new BillingProductSyncService(priceRepo as never, bachsSync as never);
  };

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    process.env.BILLING_NG_PROVIDER = 'bachs';
    process.env.BACHS_SECRET_KEY = 'sk_sandbox_test';
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    jest.restoreAllMocks();
  });

  it('auto-syncs Bachs product ids when active rows are missing them', async () => {
    const service = buildService(1);
    const heal = jest.spyOn(service, 'healMissingProductIds').mockResolvedValue({
      bachsUpdated: 1,
    });

    await service.onApplicationBootstrap();

    expect(heal).toHaveBeenCalledTimes(1);
  });

  it('does not sync when every active row already has an id', async () => {
    const service = buildService(0);
    const heal = jest.spyOn(service, 'healMissingProductIds').mockResolvedValue({
      bachsUpdated: 0,
    });

    await service.onApplicationBootstrap();

    expect(heal).not.toHaveBeenCalled();
  });
});
