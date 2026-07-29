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
