import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FeatureAccess, SubscriptionStatus } from 'src/common/enums/subscription.enum';
import { PlansService } from '../../plans/services/plans.service';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { TenantSubscription } from '../entities/tenant-subscription.entity';
import { SubscriptionsService } from './subscriptions.service';

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;
  let subscriptionRepo: { findOne: jest.Mock };

  beforeEach(async () => {
    subscriptionRepo = { findOne: jest.fn() };

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
          useValue: { getPlanPrice: jest.fn(), getPricesForCountry: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(SubscriptionsService);
  });

  describe('isSubscriptionEntitled', () => {
    it('allows active subscriptions', () => {
      const sub = {
        status: SubscriptionStatus.ACTIVE,
        trialEndsAt: null,
      } as TenantSubscription;
      expect(service.isSubscriptionEntitled(sub)).toBe(true);
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

    it('denies payroll when plan lacks feature', async () => {
      subscriptionRepo.findOne.mockResolvedValue({
        status: SubscriptionStatus.TRIAL,
        trialEndsAt: new Date(Date.now() + 86_400_000),
        plan: { features: { [FeatureAccess.BASIC_HR]: true } },
      });

      const allowed = await service.hasFeatureAccess('tenant-1', [FeatureAccess.PAYROLL]);
      expect(allowed).toBe(false);
    });
  });

  describe('computeNeedsPayment', () => {
    it('requires payment when trial days are zero', () => {
      expect(
        service.computeNeedsPayment({
          status: SubscriptionStatus.TRIAL,
          daysRemaining: 0,
        }),
      ).toBe(true);
    });

    it('does not require payment for active subscription', () => {
      expect(
        service.computeNeedsPayment({
          status: SubscriptionStatus.ACTIVE,
          daysRemaining: null,
        }),
      ).toBe(false);
    });
  });
});
