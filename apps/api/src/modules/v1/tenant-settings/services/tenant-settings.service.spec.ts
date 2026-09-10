import { BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EncryptionService } from 'src/common/services/encryption.service';
import { SettingsReaderService } from './settings-reader.service';
import { SettingsWriterService } from './settings-writer.service';
import { TenantSettingRepository } from './tenant-setting.repository';
import { TenantSettingsService } from './tenant-settings.service';

describe('TenantSettingsService rewards validation', () => {
  let service: TenantSettingsService;
  let writer: SettingsWriterService;
  let repository: { findOne: jest.Mock; save: jest.Mock };
  let eventEmitter: { emit: jest.Mock };
  let encryptionService: { encrypt: jest.Mock; decrypt: jest.Mock; isEncrypted: jest.Mock };

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
      save: jest.fn().mockImplementation(async (row) => structuredClone(row)),
    };
    eventEmitter = { emit: jest.fn() };
    encryptionService = {
      encrypt: jest.fn((value: string) => `enc:${value}`),
      decrypt: jest.fn((value: string) => value.replace(/^enc:/, '')),
      isEncrypted: jest.fn((value: string) => value.startsWith('enc:')),
    };

    const reader = {
      getTenantSettings: jest
        .fn()
        .mockImplementation(async () => repository.findOne({ where: { tenantId: 'tenant-1' } })),
      getTenantSettingsForDisplay: jest.fn(),
      resolveRewardsDefaults: jest.fn().mockResolvedValue({
        tenantCountryCode: 'US',
        rewardsCurrency: 'USD',
      }),
    } as unknown as SettingsReaderService;

    writer = new SettingsWriterService(
      repository as unknown as TenantSettingRepository,
      reader,
      eventEmitter as unknown as EventEmitter2,
      { queueActivity: jest.fn().mockResolvedValue(undefined) } as never,
      encryptionService as unknown as EncryptionService,
    );

    service = new TenantSettingsService(reader, writer);
  });

  it.each([0, -1])('rejects exchange rate %p', async (rate) => {
    await expect(
      service.updateTenantSettings(
        'tenant-1',
        {
          rewards: { pointsExchangeRate: rate },
        },
        'member-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts exchange rate 1', async () => {
    const result = await service.updateTenantSettings(
      'tenant-1',
      {
        rewards: { pointsExchangeRate: 1 },
      },
      'member-1',
    );
    expect(result.settings.rewards?.pointsExchangeRate).toBe(1);
  });

  it('accepts fractional exchange rate 0.5', async () => {
    const result = await service.updateTenantSettings(
      'tenant-1',
      {
        rewards: { pointsExchangeRate: 0.5 },
      },
      'member-1',
    );
    expect(result.settings.rewards?.pointsExchangeRate).toBe(0.5);
  });

  it('accepts fractional exchange rate 0.001', async () => {
    const result = await service.updateTenantSettings(
      'tenant-1',
      {
        rewards: { pointsExchangeRate: 0.001 },
      },
      'member-1',
    );
    expect(result.settings.rewards?.pointsExchangeRate).toBe(0.001);
  });
});
