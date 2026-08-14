import { BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EncryptionService } from 'src/common/services/encryption.service';
import { DataSource } from 'typeorm';
import { TenantSettingRepository } from './tenant-setting.repository';
import { TenantSettingsService } from './tenant-settings.service';

describe('TenantSettingsService rewards validation', () => {
  let service: TenantSettingsService;
  let repository: { findOne: jest.Mock; save: jest.Mock };
  let eventEmitter: { emit: jest.Mock };
  let tenantRepository: { findOne: jest.Mock };
  let walletRepository: { findOne: jest.Mock };
  let dataSource: { getRepository: jest.Mock };
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
    tenantRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: baseSettings.tenantId,
        countryCode: 'US',
        preferredCurrency: 'USD',
        createdBy: { countryCode: 'US' },
      }),
    };
    walletRepository = {
      findOne: jest.fn().mockResolvedValue(null),
    };
    dataSource = {
      getRepository: jest.fn((entity: { name: string }) => {
        if (entity.name === 'TenantWallet') {
          return walletRepository;
        }
        return {};
      }),
    };
    encryptionService = {
      encrypt: jest.fn((value: string) => `enc:${value}`),
      decrypt: jest.fn((value: string) => value.replace(/^enc:/, '')),
      isEncrypted: jest.fn((value: string) => value.startsWith('enc:')),
    };

    service = new TenantSettingsService(
      repository as unknown as TenantSettingRepository,
      dataSource as unknown as DataSource,
      eventEmitter as unknown as EventEmitter2,
      { queueActivity: jest.fn().mockResolvedValue(undefined) } as never,
      tenantRepository as never,
      encryptionService as unknown as EncryptionService,
    );
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

  it('accepts exchange rates below 1 when positive', async () => {
    const result = await service.updateTenantSettings(
      'tenant-1',
      {
        rewards: { pointsExchangeRate: 0.5 },
      },
      'member-1',
    );
    expect(result.settings.rewards?.pointsExchangeRate).toBe(0.5);
  });

  it('accepts small positive exchange rates', async () => {
    const result = await service.updateTenantSettings(
      'tenant-1',
      {
        rewards: { pointsExchangeRate: 0.001 },
      },
      'member-1',
    );
    expect(result.settings.rewards?.pointsExchangeRate).toBe(0.001);
  });

  it('uses initial workspace currency when no wallet exists yet', async () => {
    const result = await service.updateTenantSettings(
      'tenant-1',
      {
        rewards: { rewardsCurrency: 'NGN' },
      },
      'member-1',
    );
    expect(result.settings.rewards?.rewardsCurrency).toBe('USD');
  });

  it('mirrors funded wallet currency instead of tenant defaults', async () => {
    walletRepository.findOne.mockResolvedValue({
      currencyCode: 'NGN',
      balanceAmount: 5000,
    });

    const result = await service.updateTenantSettings(
      'tenant-1',
      {
        rewards: { rewardsCurrency: 'USD' },
      },
      'member-1',
    );

    expect(result.settings.rewards?.rewardsCurrency).toBe('NGN');
  });

  it('uses the tenant country as the default rewards catalog country', async () => {
    repository.findOne.mockResolvedValueOnce({
      tenantId: baseSettings.tenantId,
      settings: {},
    });
    tenantRepository.findOne.mockResolvedValueOnce({
      id: baseSettings.tenantId,
      countryCode: 'NG',
      preferredCurrency: 'USD',
      createdBy: { countryCode: 'GB' },
    });

    const result = await service.getTenantSettingsForDisplay('tenant-1');

    expect(result.settings.rewards).toEqual(
      expect.objectContaining({
        rewardsCurrency: 'NGN',
        pointsExchangeRate: 1,
        enabled: true,
      }),
    );
  });

  it('does not emit catalog sync when only gift card visibility changes', async () => {
    await service.updateTenantSettings(
      'tenant-1',
      {
        rewards: { giftCardsEnabled: true },
      },
      'member-1',
    );
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('emits catalog sync when gift card provider changes', async () => {
    tenantRepository.findOne.mockResolvedValue({
      id: baseSettings.tenantId,
      countryCode: 'NG',
      preferredCurrency: 'NGN',
    });
    await service.updateTenantSettings(
      'tenant-1',
      {
        rewards: { giftCardProvider: 'reloadly' },
      },
      'member-1',
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith('rewards.catalogCountriesChanged', {
      tenantId: 'tenant-1',
    });
  });

  it('does not emit catalog sync when countries and provider are unchanged', async () => {
    tenantRepository.findOne.mockResolvedValue({
      id: baseSettings.tenantId,
      countryCode: 'NG',
      preferredCurrency: 'NGN',
    });
    await service.updateTenantSettings(
      'tenant-1',
      {
        rewards: { giftCardsEnabled: true },
      },
      'member-1',
    );
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('encrypts workspace identity before saving and decrypts on read', async () => {
    repository.findOne.mockResolvedValueOnce({
      tenantId: baseSettings.tenantId,
      settings: {
        billing: { identityBvn: 'enc:12345678901', identityNin: 'enc:10987654321' },
        rewards: { ...baseSettings.settings.rewards },
      },
    });

    const settings = await service.getTenantSettings('tenant-1');
    expect(settings.settings.billing?.identityBvn).toBe('12345678901');
    expect(settings.settings.billing?.identityNin).toBe('10987654321');

    await service.updateTenantSettings(
      'tenant-1',
      {
        billing: { identityBvn: '12345678901', identityNin: '10987654321' },
      },
      'member-1',
    );

    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        settings: expect.objectContaining({
          billing: expect.objectContaining({
            identityBvn: 'enc:12345678901',
            identityNin: 'enc:10987654321',
          }),
        }),
      }),
    );
  });
});
