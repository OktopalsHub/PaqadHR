import { BadRequestException } from '@nestjs/common';
import { FiatExchangeService } from './fiat-exchange.service';

describe('FiatExchangeService', () => {
  let service: FiatExchangeService;

  beforeEach(() => {
    jest.restoreAllMocks();
    delete process.env.FX_CACHE_TTL_SECONDS;
    service = new FiatExchangeService();
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
});
