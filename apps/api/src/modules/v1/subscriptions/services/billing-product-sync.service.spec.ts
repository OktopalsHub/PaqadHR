import type { PlanPrice } from '../../plans/entities/plan-price.entity';
import { BillingProductSyncService } from './billing-product-sync.service';

describe('BillingProductSyncService Bachs currency_options', () => {
  const priceRepo = { find: jest.fn(), save: jest.fn(), count: jest.fn() };
  const service = new BillingProductSyncService(priceRepo as never);

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
