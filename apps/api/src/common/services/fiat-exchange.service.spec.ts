import { BadRequestException } from '@nestjs/common';
import { FiatExchangeService } from './fiat-exchange.service';

describe('FiatExchangeService', () => {
  let service: FiatExchangeService;
  let reloadlyTopupsApi: {
    isConfigured: jest.Mock;
    listOperators: jest.Mock;
    getOperatorFxRate: jest.Mock;
  };

  beforeEach(() => {
    jest.restoreAllMocks();
    delete process.env.FX_CACHE_TTL_SECONDS;

    reloadlyTopupsApi = {
      isConfigured: jest.fn().mockReturnValue(false),
      listOperators: jest.fn(),
      getOperatorFxRate: jest.fn(),
    };

    service = new FiatExchangeService(reloadlyTopupsApi as any);
  });

  it('returns amount unchanged for same currency', async () => {
    await expect(service.convert(100, 'NGN', 'NGN')).resolves.toBe(100);
  });

  it('converts via Frankfurter v2 when Reloadly is unavailable', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        date: '2026-03-25',
        base: 'USD',
        quote: 'NGN',
        rate: 1500,
      }),
    } as Response);

    await expect(service.convert(10, 'USD', 'NGN')).resolves.toBe(15000);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.frankfurter.dev/v2/rate/USD/NGN',
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    );
  });

  it('uses cached rate on subsequent conversions', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        date: '2026-03-25',
        base: 'USD',
        quote: 'NGN',
        rate: 1500,
      }),
    } as Response);

    await service.convert(10, 'USD', 'NGN');
    await service.convert(20, 'USD', 'NGN');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws when Frankfurter fails', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 503,
    } as Response);

    await expect(service.convert(10, 'USD', 'NGN')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('converts via Reloadly topups when configured', async () => {
    reloadlyTopupsApi.isConfigured.mockReturnValue(true);
    reloadlyTopupsApi.listOperators.mockImplementation(async (country: string) => {
      if (country === 'US') {
        return [{ operatorId: 1, fx: { rate: 1, currencyCode: 'USD' } }];
      }
      if (country === 'NG') {
        return [{ operatorId: 2, fx: { rate: 1500, currencyCode: 'NGN' } }];
      }
      return [];
    });
    reloadlyTopupsApi.getOperatorFxRate.mockResolvedValue({
      fxRate: 1,
      currencyCode: 'USD',
    });

    const fetchMock = jest.spyOn(global, 'fetch');

    await expect(service.convert(10, 'USD', 'NGN', { countryCode: 'US' })).resolves.toBe(15000);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
