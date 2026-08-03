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
    it('normalizes lowercase country codes with surrounding whitespace before saving', async () => {
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
        countryCode: 'NG',
      });

      const result = await service.updateTenant('tenant-1', {
        countryCode: ' ng ',
      });

      expect(tenantRepository.update).toHaveBeenCalledWith(
        'tenant-1',
        expect.objectContaining({
          countryCode: 'NG',
          slug: 'acme',
        }),
      );
      expect(employmentRepository.count).not.toHaveBeenCalled();
      expect(result).toEqual(
        expect.objectContaining({
          countryCode: 'NG',
        }),
      );
    });

    it('rejects invalid country codes before persisting changes', async () => {
      tenantRepository.findById.mockResolvedValue({
        id: 'tenant-1',
        slug: 'acme',
        preferredCurrency: 'USD',
      });

      await expect(
        service.updateTenant('tenant-1', {
          countryCode: 'nigeria',
        }),
      ).rejects.toThrow(
        new BadRequestException('Country code must be a valid ISO 3166-1 alpha-2 code'),
      );

      expect(tenantRepository.update).not.toHaveBeenCalled();
      expect(tenantRepository.findOne).not.toHaveBeenCalled();
    });

    it('throws when the tenant does not exist', async () => {
      tenantRepository.findById.mockResolvedValue(null);

      await expect(service.updateTenant('tenant-1', { countryCode: 'NG' })).rejects.toThrow(
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
          'Rewards wallet has activity in USD. Spend the balance before changing workspace country or currency.',
        ),
      );

      expect(tenantRepository.update).not.toHaveBeenCalled();
    });
  });
});
