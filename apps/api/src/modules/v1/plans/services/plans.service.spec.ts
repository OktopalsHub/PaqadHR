import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { PlanRegionalConfig } from 'src/common/interfaces/plan-regional-config.interface';
import { Plan } from '../entities/plan.entity';
import { PlanPrice } from '../entities/plan-price.entity';
import { PlansService } from './plans.service';

describe('PlansService', () => {
  let service: PlansService;
  let planRepository: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let planPriceRepository: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };

  beforeEach(async () => {
    planRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn().mockImplementation((data) => data),
      save: jest.fn().mockImplementation(async (data) => data),
    };
    planPriceRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn().mockImplementation((data) => data),
      save: jest.fn().mockImplementation(async (data) => data),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlansService,
        {
          provide: getRepositoryToken(Plan),
          useValue: planRepository,
        },
        {
          provide: getRepositoryToken(PlanPrice),
          useValue: planPriceRepository,
        },
      ],
    }).compile();

    service = module.get(PlansService);
  });

  describe('findPlanBySlug', () => {
    it('filters to active plans by default', async () => {
      planRepository.findOne.mockResolvedValue(null);

      await service.findPlanBySlug('growth');

      expect(planRepository.findOne).toHaveBeenCalledWith({
        where: { slug: 'growth', isActive: true },
        relations: ['prices'],
      });
    });
  });

  describe('getPricesForCountry / getPlanPrice', () => {
    it('does not fall back to GLOBAL for NG when no NG rows exist', async () => {
      planPriceRepository.find.mockResolvedValueOnce([]);

      const prices = await service.getPricesForCountry('NG');

      expect(prices).toEqual([]);
      expect(planPriceRepository.find).toHaveBeenCalledTimes(1);
      expect(planPriceRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { countryCode: 'NG', isActive: true } }),
      );
    });

    it('falls back to GLOBAL for non-NG countries when country rows are missing', async () => {
      const globalPrices = [{ id: 'g1', countryCode: 'GLOBAL', currency: 'USD' }];
      planPriceRepository.find.mockResolvedValueOnce([]).mockResolvedValueOnce(globalPrices);

      const prices = await service.getPricesForCountry('GH');

      expect(prices).toEqual(globalPrices);
      expect(planPriceRepository.find).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ where: { countryCode: 'GLOBAL', isActive: true } }),
      );
    });

    it('getPlanPrice does not fall back to GLOBAL for NG misses', async () => {
      planRepository.findOne.mockResolvedValue({ id: 'plan-1', slug: 'growth', isActive: true });
      planPriceRepository.findOne.mockResolvedValue(null);

      const price = await service.getPlanPrice('growth', 'NG', 'NGN');

      expect(price).toBeNull();
      expect(planPriceRepository.findOne).toHaveBeenCalledTimes(1);
      expect(planPriceRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            planId: 'plan-1',
            countryCode: 'NG',
            currency: 'NGN',
          }),
        }),
      );
    });

    it('getPlanPrice falls back to GLOBAL for GH misses', async () => {
      planRepository.findOne.mockResolvedValue({ id: 'plan-1', slug: 'growth', isActive: true });
      const globalPrice = { id: 'g1', countryCode: 'GLOBAL', currency: 'USD' };
      planPriceRepository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(globalPrice);

      const price = await service.getPlanPrice('growth', 'GH', 'USD');

      expect(price).toEqual(globalPrice);
      expect(planPriceRepository.findOne).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: { planId: 'plan-1', countryCode: 'GLOBAL', isActive: true },
        }),
      );
    });
  });

  describe('upsertPlanWithPrice', () => {
    const regionalConfig = {
      includedUsers: 25,
      minimumUsers: 1,
      pricePerUser: 2500,
      overagePricePerUser: 2500,
      payrollFeePercentage: 3,
    } satisfies PlanRegionalConfig;

    it('reactivates an inactive plan with the same slug instead of creating a duplicate', async () => {
      const inactivePlan = {
        id: 'plan-1',
        slug: 'growth',
        name: 'Growth',
        description: 'Archived plan',
        features: { analytics: true },
        limits: { employees: 25 },
        sortOrder: 2,
        isActive: false,
        prices: [],
      };
      const createPlanSpy = jest.spyOn(service, 'createPlan');

      planRepository.findOne.mockResolvedValue(inactivePlan);
      planRepository.save.mockImplementation(async (data) => data);
      planPriceRepository.findOne.mockResolvedValue(null);
      planPriceRepository.save.mockImplementation(async (data) => ({
        id: 'price-1',
        ...data,
      }));

      await service.upsertPlanWithPrice({
        slug: 'growth',
        name: 'Growth',
        description: 'Reactivated plan',
        countryCode: 'NG',
        currency: 'NGN',
        monthlyPrice: 3500,
        regionalConfig,
        features: { analytics: true, payroll: true },
        limits: { employees: 100 },
        sortOrder: 3,
      });

      expect(planRepository.findOne).toHaveBeenCalledWith({
        where: { slug: 'growth' },
        relations: ['prices'],
      });
      expect(createPlanSpy).not.toHaveBeenCalled();
      expect(planRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'plan-1',
          slug: 'growth',
          isActive: true,
          description: 'Reactivated plan',
          sortOrder: 3,
        }),
      );
    });
  });
});
