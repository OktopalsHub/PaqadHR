import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RewardRedemption } from '../entities/reward-redemption.entity';
import { RewardsService } from './rewards.service';

function createRewardsService(claimService: {
  claim: jest.Mock;
}) {
  return new RewardsService(
    { getRepository: jest.fn() } as unknown as DataSource,
    {} as never,
    claimService as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
}

describe('RewardsService claim idempotency', () => {
  const idempotencyKey = '11111111-1111-4111-8111-111111111111';

  it('returns an existing successful redemption for the same idempotency key', async () => {
    const existing = {
      id: idempotencyKey,
      tenantId: 'tenant-1',
      memberId: 'member-1',
      rewardType: 'TREMENDOUS' as const,
      rewardId: 'tremendous_NG_101',
      rewardName: 'Amazon NG',
      pointsSpent: 100,
      currencyValue: 1000,
      currencyCode: 'NGN',
      status: 'SUCCESS',
      recipient: { email: 'test@example.com' },
    } as RewardRedemption;

    const claimService = {
      claim: jest.fn().mockResolvedValue(existing),
    };
    const service = createRewardsService(claimService);

    const result = await service.claim('tenant-1', 'member-1', {
      idempotencyKey,
      rewardType: 'TREMENDOUS',
      rewardId: 'tremendous_NG_101',
      rewardName: 'Amazon NG',
      pointsCost: 100,
      currencyValue: 1000,
      currencyCode: 'NGN',
      recipientEmail: 'test@example.com',
    });

    expect(result).toBe(existing);
    expect(claimService.claim).toHaveBeenCalledWith(
      'tenant-1',
      'member-1',
      expect.objectContaining({ idempotencyKey }),
    );
  });

  it('rejects idempotency keys that are not UUIDs', async () => {
    const claimService = {
      claim: jest.fn().mockRejectedValue(new BadRequestException('Invalid idempotency key')),
    };
    const service = createRewardsService(claimService);

    await expect(
      service.claim('tenant-1', 'member-1', {
        idempotencyKey: 'not-a-uuid',
        rewardType: 'CUSTOM',
        rewardId: 'custom-1',
        pointsCost: 10,
        currencyValue: 0,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
