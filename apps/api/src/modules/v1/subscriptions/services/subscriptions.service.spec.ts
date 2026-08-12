import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FeatureAccess, SubscriptionStatus } from 'src/common/enums/subscription.enum';
import { PlansService } from '../../plans/services/plans.service';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { TenantSubscription } from '../entities/tenant-subscription.entity';
import { SubscriptionsService } from './subscriptions.service';

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;
  let subscriptionRepo: { findOne: jest.Mock; save: jest.Mock };
  let plansService: {
    getPlanPrice: jest.Mock;
    getPricesForCountry: jest.Mock;
    getPlanPriceById: jest.Mock;
  };

  beforeEach(async () => {
    subscriptionRepo = { findOne: jest.fn(), save: jest.fn(async (s) => s) };
    plansService = {
      getPlanPrice: jest.fn(),
      getPricesForCountry: jest.fn(),
      getPlanPriceById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        {
          provide: getRepositoryToken(TenantSubscription),
          useValue: subscriptionRepo,
        },
        {
          provide: getRepositoryToken(Tenant),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: PlansService,
          useValue: plansService,
        },
      ],
    }).compile();

    service = module.get(SubscriptionsService);
  });

  describe('isSubscriptionEntitled', () => {
    it('allows active subscriptions within the billing period', () => {
      const sub = {
        status: SubscriptionStatus.ACTIVE,
        trialEndsAt: null,
        nextBillingDate: new Date(Date.now() + 86_400_000),
      } as TenantSubscription;
      expect(service.isSubscriptionEntitled(sub)).toBe(true);
    });

    it('denies active subscriptions past renewal grace', () => {
      const sub = {
        status: SubscriptionStatus.ACTIVE,
        trialEndsAt: null,
        nextBillingDate: new Date(Date.now() - 8 * 86_400_000),
      } as TenantSubscription;
      expect(service.isSubscriptionEntitled(sub)).toBe(false);
    });

    it('allows non-expired trials', () => {
      const sub = {
        status: SubscriptionStatus.TRIAL,
        trialEndsAt: new Date(Date.now() + 86_400_000),
      } as TenantSubscription;
      expect(service.isSubscriptionEntitled(sub)).toBe(true);
    });

    it('denies expired trials', () => {
      const sub = {
        status: SubscriptionStatus.TRIAL,
        trialEndsAt: new Date(Date.now() - 86_400_000),
      } as TenantSubscription;
      expect(service.isSubscriptionEntitled(sub)).toBe(false);
    });
  });

  describe('hasFeatureAccess', () => {
    it('denies access when subscription is missing', async () => {
      subscriptionRepo.findOne.mockResolvedValue(null);
      const allowed = await service.hasFeatureAccess('tenant-1', [FeatureAccess.PAYROLL]);
      expect(allowed).toBe(false);
    });

    it('denies payroll when the plan feature key is absent', async () => {
      subscriptionRepo.findOne.mockResolvedValue({
        status: SubscriptionStatus.TRIAL,
        trialEndsAt: new Date(Date.now() + 86_400_000),
        plan: { features: { [FeatureAccess.BASIC_HR]: true } },
      });

      const allowed = await service.hasFeatureAccess('tenant-1', [FeatureAccess.PAYROLL]);
      expect(allowed).toBe(false);
    });

    it('denies access when a plan feature is explicitly false', async () => {
      subscriptionRepo.findOne.mockResolvedValue({
        status: SubscriptionStatus.ACTIVE,
        trialEndsAt: null,
        plan: { features: { [FeatureAccess.PAYROLL]: false } },
      });

      const allowed = await service.hasFeatureAccess('tenant-1', [FeatureAccess.PAYROLL]);
      expect(allowed).toBe(false);
    });

    it('allows access only when every requested feature is explicitly true', async () => {
      subscriptionRepo.findOne.mockResolvedValue({
        status: SubscriptionStatus.ACTIVE,
        trialEndsAt: null,
        plan: {
          features: {
            [FeatureAccess.PAYROLL]: true,
            [FeatureAccess.LEAVE_MANAGEMENT]: true,
          },
        },
      });

      const allowed = await service.hasFeatureAccess('tenant-1', [
        FeatureAccess.PAYROLL,
        FeatureAccess.LEAVE_MANAGEMENT,
      ]);
      expect(allowed).toBe(true);
    });
  });

  describe('computeNeedsPayment', () => {
    it('requires payment when trial has ended by date', () => {
      expect(
        service.computeNeedsPayment({
          status: SubscriptionStatus.TRIAL,
          daysRemaining: 1,
          trialEndsAt: new Date(Date.now() - 1000),
        }),
      ).toBe(true);
    });

    it('requires payment when trial days are zero without a date', () => {
      expect(
        service.computeNeedsPayment({
          status: SubscriptionStatus.TRIAL,
          daysRemaining: 0,
        }),
      ).toBe(true);
    });

    it('requires payment for active subscription past nextBillingDate', () => {
      expect(
        service.computeNeedsPayment({
          status: SubscriptionStatus.ACTIVE,
          daysRemaining: null,
          nextBillingDate: new Date(Date.now() - 1000),
        }),
      ).toBe(true);
    });

    it('does not require payment for active subscription in period', () => {
      expect(
        service.computeNeedsPayment({
          status: SubscriptionStatus.ACTIVE,
          daysRemaining: null,
          nextBillingDate: new Date(Date.now() + 86_400_000),
        }),
      ).toBe(false);
    });
  });

  describe('healNgSubscriptionPlanPrice', () => {
    it('rebinds NG trial from GLOBAL/USD to NGN plan price', async () => {
      const ngPrice = {
        id: 'ng-price',
        planId: 'plan-1',
        countryCode: 'NG',
        currency: 'NGN',
        plan: { slug: 'growth' },
      };
      plansService.getPlanPrice.mockResolvedValue(ngPrice);
      const subscription = {
        id: 'sub-1',
        status: SubscriptionStatus.TRIAL,
        planId: 'plan-1',
        planPriceId: 'usd-price',
        plan: { slug: 'growth' },
        planPrice: {
          id: 'usd-price',
          countryCode: 'GLOBAL',
          currency: 'USD',
          plan: { slug: 'growth' },
        },
      } as unknown as TenantSubscription;
      subscriptionRepo.findOne.mockResolvedValue({
        ...subscription,
        ...ngPrice,
        planPrice: ngPrice,
      });

      const result = await service.healNgSubscriptionPlanPrice('NG', subscription);

      expect(plansService.getPlanPrice).toHaveBeenCalledWith('growth', 'NG', 'NGN');
      expect(subscriptionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ planPriceId: 'ng-price', planId: 'plan-1' }),
      );
      expect(result.pricingMismatch).toBeNull();
    });

    it('surfaces mismatch for paid ACTIVE NG workspace still on USD', async () => {
      const subscription = {
        id: 'sub-1',
        status: SubscriptionStatus.ACTIVE,
        planId: 'plan-1',
        planPriceId: 'usd-price',
        plan: { slug: 'growth' },
        planPrice: {
          id: 'usd-price',
          countryCode: 'GLOBAL',
          currency: 'USD',
          plan: { slug: 'growth' },
        },
      } as unknown as TenantSubscription;
      plansService.getPlanPrice.mockResolvedValue({
        id: 'ng-price',
        countryCode: 'NG',
        currency: 'NGN',
      });

      const result = await service.healNgSubscriptionPlanPrice('NG', subscription);

      expect(subscriptionRepo.save).not.toHaveBeenCalled();
      expect(result.pricingMismatch).toEqual(
        expect.objectContaining({
          expectedCurrency: 'NGN',
          actualCurrency: 'USD',
        }),
      );
    });

    it('leaves non-NG tenants unchanged', async () => {
      const subscription = {
        status: SubscriptionStatus.TRIAL,
        planPrice: { countryCode: 'GLOBAL', currency: 'USD' },
      } as unknown as TenantSubscription;

      const result = await service.healNgSubscriptionPlanPrice('GH', subscription);

      expect(plansService.getPlanPrice).not.toHaveBeenCalled();
      expect(result.pricingMismatch).toBeNull();
      expect(result.subscription).toBe(subscription);
    });
  });
});
