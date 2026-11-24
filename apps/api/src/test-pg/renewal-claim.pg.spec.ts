import type { DataSource } from 'typeorm';

import { BillingProvider } from '../modules/v1/subscriptions/constants/billing-provider.enum';
import { RenewalSuccessApplicator } from '../modules/v1/subscriptions/services/renewal-success-applicator';
import { createPgDataSource, PG_TEST_URL } from './pg-harness';

const maybe = PG_TEST_URL ? describe : describe.skip;

maybe('renewal period claim (real Postgres)', () => {
  jest.setTimeout(180_000);
  let ds: DataSource;
  let applicator: RenewalSuccessApplicator;

  beforeAll(async () => {
    ds = await createPgDataSource();
    applicator = new RenewalSuccessApplicator(
      null as never,
      null as never,
      null as never,
      ds,
      null as never,
      null as never,
    );
  });
  afterAll(async () => {
    await ds?.destroy();
  });

  it('lets exactly one of many concurrent workers claim a billing period', async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        applicator.claimRenewalPeriod('period-a', { subscriptionId: 's1' }, BillingProvider.NOMBA),
      ),
    );
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it('does not reclaim a live pending claim, but takes over a failed one once', async () => {
    expect(await applicator.claimRenewalPeriod('period-b', {}, BillingProvider.NOMBA)).toBe(true);
    expect(await applicator.claimRenewalPeriod('period-b', {}, BillingProvider.NOMBA)).toBe(false);

    await applicator.updateRenewalPeriodClaim('period-b', { status: 'failed' }, BillingProvider.NOMBA);
    const takeovers = await Promise.all(
      Array.from({ length: 10 }, () =>
        applicator.claimRenewalPeriod('period-b', {}, BillingProvider.NOMBA),
      ),
    );
    expect(takeovers.filter(Boolean)).toHaveLength(1);
  });

  it('takes over an expired pending lease but never a charged period', async () => {
    expect(await applicator.claimRenewalPeriod('period-c', {}, BillingProvider.NOMBA)).toBe(true);
    expect(await applicator.claimRenewalPeriod('period-c', {}, BillingProvider.NOMBA, -1)).toBe(true);

    await applicator.updateRenewalPeriodClaim('period-c', { status: 'charged' }, BillingProvider.NOMBA);
    expect(await applicator.claimRenewalPeriod('period-c', {}, BillingProvider.NOMBA, -1)).toBe(false);
  });
});
