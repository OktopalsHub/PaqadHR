import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TenantSettings } from '../../tenant-settings/entities/tenant-settings.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { RewardRedemption } from '../entities/reward-redemption.entity';
import { RewardsService } from './rewards.service';

function createRewardsService(redemptionRepo: { findOne: jest.Mock }) {
  return new RewardsService(
    {
      getRepository: jest.fn((entity) => {
        if (entity === RewardRedemption) return redemptionRepo;
        if (entity === TenantSettings) {
          return {
            findOne: jest.fn().mockResolvedValue({
              tenantId: 'tenant-1',
              settings: { rewards: { enabled: true, rewardsCurrency: 'NGN' } },
            }),
          };
        }
        if (entity === Tenant) {
          return {
            findOne: jest.fn().mockResolvedValue({ id: 'tenant-1', countryCode: 'NG' }),
          };
        }
        return {};
      }),
    } as unknown as DataSource,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    { isConfigured: jest.fn().mockReturnValue(true) } as never,
    {} as never,
    { convert: jest.fn() } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    { getRedemptionFees: jest.fn().mockResolvedValue({ feePercentage: 0, flatFee: 0 }) } as never,
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
      rewardType: 'RELOADLY',
      rewardId: 'reloadly_NG_101',
      rewardName: 'Amazon NG',
      pointsSpent: 100,
      currencyValue: 1000,
      currencyCode: 'NGN',
      status: 'SUCCESS',
    } as RewardRedemption;

    const redemptionRepo = {
      findOne: jest.fn().mockResolvedValue(existing),
    };
    const service = createRewardsService(redemptionRepo);
    const settingsMock = {
      enabled: true,
      rewardsCurrency: 'NGN',
      reloadlyProducts: [],
      tremendousProducts: [],
      catalogCountries: ['NG'],
    };
    jest
      .spyOn(
        service as unknown as { getRewardsSettings: () => Promise<unknown> },
        'getRewardsSettings',
      )
      .mockResolvedValue(settingsMock);

    const result = await service.claim('tenant-1', 'member-1', {
      idempotencyKey,
      rewardType: 'RELOADLY',
      rewardId: 'reloadly_NG_101',
      rewardName: 'Amazon NG',
      pointsCost: 100,
      currencyValue: 1000,
      currencyCode: 'NGN',
    });

    expect(result).toBe(existing);
    expect(redemptionRepo.findOne).toHaveBeenCalledWith({
      where: { id: idempotencyKey, tenantId: 'tenant-1', memberId: 'member-1' },
    });
  });

  it('rejects idempotency keys that are not UUIDs', async () => {
    const service = createRewardsService({ findOne: jest.fn() });
    const settingsMock = {
      enabled: true,
      rewardsCurrency: 'NGN',
      reloadlyProducts: [],
      tremendousProducts: [],
      catalogCountries: ['NG'],
    };
    jest
      .spyOn(
        service as unknown as { getRewardsSettings: () => Promise<unknown> },
        'getRewardsSettings',
      )
      .mockResolvedValue(settingsMock);

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
