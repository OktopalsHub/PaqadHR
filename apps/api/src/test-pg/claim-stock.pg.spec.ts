import { randomUUID } from 'node:crypto';

import type { DataSource } from 'typeorm';

import { CustomReward } from '../modules/v1/rewards/entities/custom-reward.entity';
import { ClaimBillingService } from '../modules/v1/rewards/services/claim-billing.service';
import { ShoutoutMemberPoints } from '../modules/v1/shoutouts/entities/shoutout-member-points.entity';
import { createPgDataSource, PG_TEST_URL } from './pg-harness';

const maybe = PG_TEST_URL ? describe : describe.skip;

maybe('custom reward claims (real Postgres)', () => {
  jest.setTimeout(180_000);
  let ds: DataSource;
  let service: ClaimBillingService;

  beforeAll(async () => {
    ds = await createPgDataSource();
    service = new ClaimBillingService(ds, {} as never);
  });
  afterAll(async () => {
    await ds?.destroy();
  });

  const claim = (tenantId: string, memberId: string, rewardId: string, cost: number) =>
    service.debitPointsAndWallet({
      tenantId,
      memberId,
      redemptionId: randomUUID(),
      pointsCost: cost,
      totalTenantDebit: 0,
      currencyCode: 'USD',
      costs: { totalTenantDebit: 0, faceValueInRewardsCurrency: 0 },
      input: {
        rewardType: 'CUSTOM',
        rewardId,
        rewardName: 'Mug',
        currencyValue: 0,
        pointsCost: cost,
      } as never,
    });

  async function seed(stock: number | null, points: number) {
    const tenantId = randomUUID();
    const memberId = randomUUID();
    const rewardId = randomUUID();
    await ds.getRepository(CustomReward).insert({
      id: rewardId,
      tenantId,
      title: 'Mug',
      pointsCost: 10,
      isActive: true,
      stockLimit: stock,
    } as never);
    await ds
      .getRepository(ShoutoutMemberPoints)
      .insert({ tenantId, memberId, currentBalance: points, totalEarned: points });
    return { tenantId, memberId, rewardId };
  }

  it('sells exactly the remaining stock when claims arrive at the same time', async () => {
    const { tenantId, memberId, rewardId } = await seed(3, 1000);

    const results = await Promise.allSettled(
      Array.from({ length: 12 }, () => claim(tenantId, memberId, rewardId, 10)),
    );

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(3);
    const reward = await ds.getRepository(CustomReward).findOneByOrFail({ id: rewardId });
    expect(reward.stockLimit).toBe(0);
    const points = await ds
      .getRepository(ShoutoutMemberPoints)
      .findOneByOrFail({ tenantId, memberId });
    expect(points.currentBalance).toBe(1000 - 3 * 10);
  });

  it('never spends more points than the member has', async () => {
    const { tenantId, memberId, rewardId } = await seed(null, 35);

    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () => claim(tenantId, memberId, rewardId, 10)),
    );

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(3);
    const points = await ds
      .getRepository(ShoutoutMemberPoints)
      .findOneByOrFail({ tenantId, memberId });
    expect(points.currentBalance).toBe(5);
  });

  it('rolls the stock back when the points debit fails', async () => {
    const { tenantId, memberId, rewardId } = await seed(5, 0);

    await expect(claim(tenantId, memberId, rewardId, 10)).rejects.toThrow();

    const reward = await ds.getRepository(CustomReward).findOneByOrFail({ id: rewardId });
    expect(reward.stockLimit).toBe(5);
  });
});
