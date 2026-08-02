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
    encryptionService = {
      encrypt: jest.fn((value: string) => `enc:${value}`),
      decrypt: jest.fn((value: string) => value.replace(/^enc:/, '')),
      isEncrypted: jest.fn((value: string) => value.startsWith('enc:')),
    };

    service = new TenantSettingsService(
      repository as unknown as TenantSettingRepository,
      {} as DataSource,
      eventEmitter as unknown as EventEmitter2,
      {} as never,
      tenantRepository as never,
      encryptionService as unknown as EncryptionService,
    );
  });

  it.each([0, -1])('rejects exchange rate %p', async (rate) => {
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

  it('accepts exchange rates below 1 when positive', async () => {
    const result = await service.updateTenantSettings('tenant-1', {
      rewards: { pointsExchangeRate: 0.5 },
    });
    expect(result.settings.rewards?.pointsExchangeRate).toBe(0.5);
  });

  it('forces rewards currency to follow workspace currency', async () => {
    const result = await service.updateTenantSettings('tenant-1', {
      rewards: { rewardsCurrency: 'NGN' },
    });
    expect(result.settings.rewards?.rewardsCurrency).toBe('USD');
  });

  it('uses the tenant creator country as the default rewards catalog country', async () => {
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
        rewardsCurrency: 'USD',
        catalogCountries: ['GB'],
        pointsExchangeRate: 1,
        enabled: true,
      }),
    );
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

  it('encrypts Monnify identifiers before saving and decrypts on read', async () => {
    repository.findOne.mockResolvedValueOnce({
      tenantId: baseSettings.tenantId,
      settings: {
        billing: { monnifyBvn: 'enc:12345678901', monnifyNin: 'enc:10987654321' },
        rewards: { ...baseSettings.settings.rewards },
      },
    });

    const settings = await service.getTenantSettings('tenant-1');
    expect(settings.settings.billing?.monnifyBvn).toBe('12345678901');
    expect(settings.settings.billing?.monnifyNin).toBe('10987654321');

    await service.updateTenantSettings('tenant-1', {
      billing: { monnifyBvn: '12345678901', monnifyNin: '10987654321' },
    });

    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        settings: expect.objectContaining({
          billing: expect.objectContaining({
            monnifyBvn: 'enc:12345678901',
            monnifyNin: 'enc:10987654321',
          }),
        }),
      }),
    );
  });
});
