import 'reflect-metadata';

import { RATE_LIMIT_KEY, RateLimitPresets } from 'src/common/decorators/rate-limit.decorator';

import { RewardsController } from './rewards.controller';

const handler = (name: string) =>
  (RewardsController.prototype as unknown as Record<string, object>)[name];

describe('RewardsController money routes', () => {
  it.each([
    'syncCatalog',
    'claim',
    'manualTopup',
    'topupCheckout',
    'completeTopupCheckout',
    'updateAutoTopup',
    'assignPoints',
  ])('limits %s with the sensitive preset', (name) => {
    expect(Reflect.getMetadata(RATE_LIMIT_KEY, handler(name))).toBe(RateLimitPresets.SENSITIVE);
  });

  it('limits provider lookups with the general API preset', () => {
    expect(Reflect.getMetadata(RATE_LIMIT_KEY, handler('lookupUtilityMeter'))).toBe(
      RateLimitPresets.API,
    );
  });
});
