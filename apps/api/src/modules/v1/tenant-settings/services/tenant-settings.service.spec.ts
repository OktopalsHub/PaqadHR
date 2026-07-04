import { BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import { TenantSettingRepository } from './tenant-setting.repository';
import { TenantSettingsService } from './tenant-settings.service';

describe('TenantSettingsService rewards validation', () => {
  let service: TenantSettingsService;
  let repository: { findOne: jest.Mock; save: jest.Mock };
  let eventEmitter: { emit: jest.Mock };

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
      findOne: jest.fn().mockResolvedValue({
        tenantId: baseSettings.tenantId,
        settings: {
          rewards: { ...baseSettings.settings.rewards },
        },
      }),
      save: jest.fn().mockImplementation(async (row) => row),
    };
    eventEmitter = { emit: jest.fn() };

    service = new TenantSettingsService(
      repository as unknown as TenantSettingRepository,
      {} as DataSource,
      eventEmitter as unknown as EventEmitter2,
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

  it('emits catalog sync event when catalog countries change', async () => {
    await service.updateTenantSettings('tenant-1', {
      rewards: { catalogCountries: ['NG', 'US'] },
    });
    expect(eventEmitter.emit).toHaveBeenCalledWith('rewards.catalogCountriesChanged', {
      tenantId: 'tenant-1',
    });
  });

  it('does not emit catalog sync when countries are unchanged', async () => {
    await service.updateTenantSettings('tenant-1', {
      rewards: { catalogCountries: ['NG'] },
    });
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });
});
