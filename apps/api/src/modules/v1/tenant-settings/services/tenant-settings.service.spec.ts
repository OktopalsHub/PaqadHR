import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TenantSettingRepository } from './tenant-setting.repository';
import { TenantSettingsService } from './tenant-settings.service';

describe('TenantSettingsService rewards validation', () => {
  let service: TenantSettingsService;
  let repository: { findOne: jest.Mock; save: jest.Mock };

  const baseSettings = {
    tenantId: 'tenant-1',
    settings: {
      rewards: {
        enabled: true,
        pointsExchangeRate: 1,
        rewardsCurrency: 'NGN',
        catalogCountries: ['NG'],
      },
    },
  };

  beforeEach(() => {
    repository = {
      findOne: jest.fn().mockResolvedValue({ ...baseSettings }),
      save: jest.fn().mockImplementation(async (row) => row),
    };

    service = new TenantSettingsService(
      repository as unknown as TenantSettingRepository,
      {} as DataSource,
      { syncReloadlyProducts: jest.fn().mockResolvedValue([]) } as any,
    );
  });

  it.each([0, -1, 0.5])('rejects exchange rate %p', async (rate) => {
    await expect(
      service.updateTenantSettings('tenant-1', {
        rewards: { pointsExchangeRate: rate },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts exchange rate 1', async () => {
    const result = await service.updateTenantSettings('tenant-1', {
      rewards: { pointsExchangeRate: 1 },
    });
    expect(result.settings.rewards?.pointsExchangeRate).toBe(1);
  });
});
