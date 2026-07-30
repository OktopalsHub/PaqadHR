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

    service = new TenantsService(
      tenantRepository as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      employmentRepository as never,
    );
  });

  describe('updateTenant', () => {
    it('normalizes lowercase country codes with surrounding whitespace before saving', async () => {
      tenantRepository.findById.mockResolvedValue({
        id: 'tenant-1',
        slug: 'acme',
        preferredCurrency: 'USD',
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
  });
});
