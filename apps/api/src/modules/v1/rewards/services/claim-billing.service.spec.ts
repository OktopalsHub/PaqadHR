import { DataSource } from 'typeorm';
import { ShoutoutMemberPoints } from '../../shoutouts/entities/shoutout-member-points.entity';
import { ShoutoutPointTransaction } from '../../shoutouts/entities/shoutout-point-transaction.entity';
import { RewardRedemption } from '../entities/reward-redemption.entity';
import { ClaimBillingService } from './claim-billing.service';

describe('ClaimBillingService.debitPointsAndWallet', () => {
  it('commits the redemption row in the same transaction as the charges', async () => {
    const savedRedemptions: Record<string, unknown>[] = [];
    const savedPointTransactions: Record<string, unknown>[] = [];

    type PointsQueryBuilder = {
      update: () => PointsQueryBuilder;
      set: () => PointsQueryBuilder;
      where: () => { execute: () => Promise<{ affected: number }> };
    };
    const pointsQueryBuilder: PointsQueryBuilder = {
      update: () => pointsQueryBuilder,
      set: () => pointsQueryBuilder,
      where: () => ({ execute: async () => ({ affected: 1 }) }),
    };

    const manager = {
      getRepository: (entity: unknown) => {
        if (entity === RewardRedemption) {
          return {
            findOne: jest.fn().mockResolvedValue(null),
            create: (data: Record<string, unknown>) => data,
            save: jest.fn(async (row: Record<string, unknown>) => {
              savedRedemptions.push(row);
              return row;
            }),
          };
        }
        if (entity === ShoutoutMemberPoints) {
          return {
            findOne: jest.fn().mockResolvedValue({ currentBalance: 500 }),
            findOneOrFail: jest.fn().mockResolvedValue({ currentBalance: 400 }),
            createQueryBuilder: () => pointsQueryBuilder,
          };
        }
        if (entity === ShoutoutPointTransaction) {
          return {
            create: (data: Record<string, unknown>) => data,
            save: jest.fn(async (row: Record<string, unknown>) => {
              savedPointTransactions.push(row);
              return row;
            }),
          };
        }
        throw new Error(`Unexpected repository requested: ${String(entity)}`);
      },
    };

    const dataSource = {
      transaction: async (callback: (m: typeof manager) => Promise<void>) => callback(manager),
    } as unknown as DataSource;
    const walletService = { debit: jest.fn().mockResolvedValue(undefined) };
    const service = new ClaimBillingService(dataSource, walletService as never);

    await service.debitPointsAndWallet({
      tenantId: 'tenant-1',
      memberId: 'member-1',
      input: {
        rewardType: 'TREMENDOUS',
        rewardId: 'rewards_1',
        rewardName: 'Gift card',
        pointsCost: 100,
        currencyValue: 1000,
        currencyCode: 'NGN',
        recipientEmail: 'test@example.com',
      },
      redemptionId: '11111111-1111-4111-8111-111111111111',
      pointsCost: 100,
      totalTenantDebit: 1020,
      currencyCode: 'NGN',
      costs: { totalTenantDebit: 1020, faceValueInRewardsCurrency: 1000 },
    });

    expect(savedRedemptions).toEqual([
      expect.objectContaining({
        id: '11111111-1111-4111-8111-111111111111',
        tenantId: 'tenant-1',
        memberId: 'member-1',
        status: 'PENDING',
        pointsSpent: 100,
        rewardType: 'TREMENDOUS',
      }),
    ]);
    expect(walletService.debit).toHaveBeenCalledWith(
      'tenant-1',
      1020,
      '11111111-1111-4111-8111-111111111111',
      expect.stringContaining('Reward claim: Gift card'),
      'member-1',
      manager,
    );
    expect(savedPointTransactions).toHaveLength(1);
  });
});
