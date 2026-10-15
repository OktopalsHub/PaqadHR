import type { Request } from 'express';
import { SubscriptionsController } from './subscriptions.controller';

/** Minimal Express request behind a private proxy hop (as in prod behind Cloudflare). */
function makeRequest(headers: Request['headers'] = {}): Request {
  return {
    headers,
    socket: { remoteAddress: '10.0.0.2' },
    ip: '10.0.0.2',
  } as unknown as Request;
}

describe('SubscriptionsController.getLandingPricing', () => {
  const controller = new SubscriptionsController({} as never);

  it('returns NGN for a Nigerian visitor detected from the edge header', async () => {
    await expect(
      controller.getLandingPricing(makeRequest({ 'cf-ipcountry': 'NG' })),
    ).resolves.toEqual({ countryCode: 'NG', currency: 'NGN' });
  });

  it('returns USD for a non-Nigerian visitor detected from the edge header', async () => {
    await expect(
      controller.getLandingPricing(makeRequest({ 'cf-ipcountry': 'US' })),
    ).resolves.toEqual({ countryCode: 'US', currency: 'USD' });
  });

  it('falls back to USD when no country can be detected', async () => {
    await expect(controller.getLandingPricing(makeRequest())).resolves.toEqual({
      countryCode: 'GLOBAL',
      currency: 'USD',
    });
  });
});
