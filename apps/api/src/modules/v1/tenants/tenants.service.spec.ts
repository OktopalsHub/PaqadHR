import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TenantsService } from './tenants.service';

describe('TenantsService', () => {
  let service: TenantsService;
  let tenantRepository: {
    findById: jest.Mock;
    update: jest.Mock;
    findOne: jest.Mock;
    findBySlug: jest.Mock;
  };
  let employmentRepository: {
    count: jest.Mock;
  };
  let walletRepository: {
    findOne: jest.Mock;
  };
  let walletTransactionRepository: {
    count: jest.Mock;
  };

  beforeEach(() => {
    tenantRepository = {
      findById: jest.fn(),
      update: jest.fn(),
      findOne: jest.fn(),
      findBySlug: jest.fn(),
    };
    employmentRepository = {
      count: jest.fn(),
    };
    walletRepository = {
      findOne: jest.fn().mockResolvedValue(null),
    };
    walletTransactionRepository = {
      count: jest.fn().mockResolvedValue(0),
    };

    service = new TenantsService(
      tenantRepository as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      employmentRepository as never,
      walletRepository as never,
      walletTransactionRepository as never,
    );
  });

  describe('updateTenant', () => {
    it('updates timezone without changing country', async () => {
      tenantRepository.findById.mockResolvedValue({
        id: 'tenant-1',
        slug: 'acme',
        preferredCurrency: 'USD',
        countryCode: 'US',
      });
      tenantRepository.findOne.mockResolvedValue({
        id: 'tenant-1',
        slug: 'acme',
        preferredCurrency: 'USD',
        countryCode: 'US',
        timezone: 'Africa/Lagos',
      });

      const result = await service.updateTenant('tenant-1', {
        timezone: 'Africa/Lagos',
      });

      expect(tenantRepository.update).toHaveBeenCalledWith(
        'tenant-1',
        expect.objectContaining({
          timezone: 'Africa/Lagos',
          slug: 'acme',
        }),
      );
      expect(result).toEqual(
        expect.objectContaining({
          countryCode: 'US',
          timezone: 'Africa/Lagos',
        }),
      );
    });

    it('throws when the tenant does not exist', async () => {
      tenantRepository.findById.mockResolvedValue(null);

      await expect(service.updateTenant('tenant-1', { timezone: 'UTC' })).rejects.toThrow(
        new NotFoundException('Tenant does not exist'),
      );
    });

    it('blocks preferredCurrency change when rewards wallet is funded', async () => {
      tenantRepository.findById.mockResolvedValue({
        id: 'tenant-1',
        slug: 'acme',
        preferredCurrency: 'USD',
        countryCode: 'US',
      });
      employmentRepository.count.mockResolvedValue(0);
      walletRepository.findOne.mockResolvedValue({
        id: 'wallet-1',
        currencyCode: 'USD',
        balanceAmount: 2500,
      });
      walletTransactionRepository.count.mockResolvedValue(0);

      await expect(service.updateTenant('tenant-1', { preferredCurrency: 'EUR' })).rejects.toThrow(
        new BadRequestException(
          'Rewards wallet has activity in USD. Spend the balance before changing workspace currency.',
        ),
      );

      expect(tenantRepository.update).not.toHaveBeenCalled();
    });
  });
});
