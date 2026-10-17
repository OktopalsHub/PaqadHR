import { BachsApiService } from './bachs-api.service';

type FetchCall = { url: string; method: string; body?: unknown };

function stubFetch(responses: Record<string, unknown>): { calls: FetchCall[] } {
  const calls: FetchCall[] = [];
  global.fetch = jest.fn(async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET';
    calls.push({
      url: String(url),
      method,
      body: init.body ? JSON.parse(String(init.body)) : undefined,
    });
    const key = `${method} ${String(url).split('/v1')[1] ?? String(url)}`;
    const payload = responses[key] ?? responses[`${method} ${String(url)}`] ?? {};
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      // request() reads the body as text before parsing, so the stub has to
      // expose text() as well as json().
      text: async () => JSON.stringify(payload),
      json: async () => payload,
    } as unknown as Response;
  });
  return { calls };
}

describe('BachsApiService.isAdaptivePricingEnabled', () => {
  const OLD_ENV = process.env.BACHS_SECRET_KEY;

  beforeEach(() => {
    process.env.BACHS_SECRET_KEY = 'sk_sandbox_test';
    process.env.BACHS_BASE_URL = 'https://sandbox-api.bachs.io';
  });

  afterAll(() => {
    process.env.BACHS_SECRET_KEY = OLD_ENV;
  });

  it('reads adaptive_pricing from the account, not checkout settings', async () => {
    const { calls } = stubFetch({ 'GET /accounts/me': { adaptive_pricing: true } });
    const service = new BachsApiService();

    await expect(service.isAdaptivePricingEnabled()).resolves.toBe(true);
    // Checkout settings never returns adaptive_pricing, so it is not the source.
    expect(calls.some((c) => c.url.includes('/checkout/settings'))).toBe(false);
  });

  it('never PUTs adaptive_pricing — the endpoint rejects that field', async () => {
    const { calls } = stubFetch({ 'GET /accounts/me': { adaptive_pricing: false } });
    const service = new BachsApiService();

    await expect(service.isAdaptivePricingEnabled()).resolves.toBe(false);
    expect(calls.some((c) => c.method === 'PUT')).toBe(false);
    // Sending enabled_payment_methods just to satisfy anyOf would replace every
    // corridor wholesale, so it must never be used as a workaround.
    expect(JSON.stringify(calls)).not.toContain('enabled_payment_methods');
  });

  it('reports false and does not cache when the read fails', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;
    const service = new BachsApiService();

    await expect(service.isAdaptivePricingEnabled()).resolves.toBe(false);

    // A transient failure must not be cached as "off" for the whole process.
    global.fetch = jest.fn(
      async (url: string, init: RequestInit = {}) =>
        ({
          ok: true,
          status: 200,
          statusText: 'OK',
          text: async () => JSON.stringify({ adaptive_pricing: true }),
          json: async () => ({ adaptive_pricing: true }),
        }) as unknown as Response,
    ) as unknown as typeof fetch;
    await expect(service.isAdaptivePricingEnabled()).resolves.toBe(true);
  });

  it('caches a successful read', async () => {
    stubFetch({ 'GET /accounts/me': { adaptive_pricing: true } });
    const service = new BachsApiService();

    await service.isAdaptivePricingEnabled();
    await service.isAdaptivePricingEnabled();

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
