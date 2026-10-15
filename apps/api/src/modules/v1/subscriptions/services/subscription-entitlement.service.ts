import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FeatureAccess, SubscriptionStatus } from 'src/common/enums/subscription.enum';
import { In, Repository } from 'typeorm';
import { hasPlanFeaturesAccess } from '../../../../common/constants/feature-access-resolver';
import {
  AuditAction,
  AuditSeverity,
  AuditStatus,
} from '../../../../common/enums/audit-action.enum';
import { AuditLogsService } from '../../audit-logs/services/audit-logs.service';
import { isPayrollGatewayEnabled } from '../../payroll/config/payroll-disbursement.config';
import { isBillingGatewayEnabled, isFeatureGatingEnabled } from '../config/billing.config';
import { TenantSubscription } from '../entities/tenant-subscription.entity';
import { isWithinRenewalGrace } from '../utils/dunning.util';

export type NeedsPaymentInput = {
  status: SubscriptionStatus;
  daysRemaining?: number | null;
  trialEndsAt?: Date | string | null;
  nextBillingDate?: Date | string | null;
} | null;

export type TenantEntitlementSnapshot = {
  entitled: boolean;
  needsPayment: boolean;
  plan: string | null;
};

@Injectable()
export class SubscriptionEntitlementService {
  constructor(
    @InjectRepository(TenantSubscription)
    private readonly subscriptionRepository: Repository<TenantSubscription>,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async getTenantSubscription(tenantId: string): Promise<TenantSubscription | null> {
    return this.subscriptionRepository.findOne({
      where: { tenantId },
      relations: ['tenant', 'plan', 'planPrice', 'planPrice.plan'],
    });
  }

  async updateTenantSubscription(
    tenantId: string,
    updates: Partial<TenantSubscription>,
  ): Promise<TenantSubscription> {
    const subscription = await this.getTenantSubscription(tenantId);
    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }
    Object.assign(subscription, updates);
    const saved = await this.subscriptionRepository.save(subscription);

    void this.auditLogsService
      .queueAuditLog({
        action: AuditAction.SUBSCRIPTION_CREATED,
        description: `Subscription updated`,
        severity: AuditSeverity.MEDIUM,
        status: AuditStatus.SUCCESS,
        resourceType: 'tenant_subscription',
        resourceId: subscription.id,
        tenantId,
        metadata: { updatedFields: Object.keys(updates) },
      })
      .catch(() => {});

    return saved;
  }

  async getEntitlementsForTenants(
    tenantIds: string[],
  ): Promise<Map<string, TenantEntitlementSnapshot>> {
    const entitlements = new Map<string, TenantEntitlementSnapshot>();
    if (!tenantIds.length) {
      return entitlements;
    }

    const subscriptions = await this.subscriptionRepository.find({
      where: { tenantId: In(tenantIds) },
      relations: ['plan'],
      select: {
        id: true,
        tenantId: true,
        planId: true,
        status: true,
        trialEndsAt: true,
        nextBillingDate: true,
        currentPeriodEnd: true,
        plan: {
          id: true,
          slug: true,
          name: true,
        },
      },
    });

    const subscriptionByTenant = new Map(
      subscriptions.map((subscription) => [subscription.tenantId, subscription]),
    );

    for (const tenantId of tenantIds) {
      const subscription = subscriptionByTenant.get(tenantId);
      if (!subscription) {
        entitlements.set(tenantId, { entitled: false, needsPayment: true, plan: null });
        continue;
      }

      let daysRemaining: number | null = null;
      if (subscription.trialEndsAt) {
        const ms = subscription.trialEndsAt.getTime() - Date.now();
        daysRemaining = Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
      }

      const summary = {
        status: subscription.status,
        trialEndsAt: subscription.trialEndsAt,
        nextBillingDate: subscription.nextBillingDate,
        daysRemaining,
      };

      entitlements.set(tenantId, {
        entitled: this.isSubscriptionEntitled(subscription),
        needsPayment: this.computeNeedsPayment(summary),
        plan: subscription.plan?.slug ?? subscription.plan?.name ?? null,
      });
    }

    return entitlements;
  }

  async hasFeatureAccess(tenantId: string, features: FeatureAccess[]): Promise<boolean> {
    if (!isFeatureGatingEnabled()) {
      return true;
    }

    const subscription = await this.getTenantSubscription(tenantId);
    if (!subscription || !this.isSubscriptionEntitled(subscription)) {
      return false;
    }

    const planFeatures = subscription.plan?.features ?? {};
    return hasPlanFeaturesAccess(planFeatures, features);
  }

  isSubscriptionEntitled(subscription: TenantSubscription): boolean {
    const now = new Date();
    if (subscription.status === SubscriptionStatus.ACTIVE) {
      if (subscription.nextBillingDate && now >= subscription.nextBillingDate) {
        return isWithinRenewalGrace(subscription.nextBillingDate, now);
      }
      return true;
    }
    if (subscription.status === SubscriptionStatus.TRIAL) {
      if (!subscription.trialEndsAt) {
        return true;
      }
      return now < subscription.trialEndsAt;
    }
    if (subscription.status === SubscriptionStatus.PAST_DUE) {
      return isWithinRenewalGrace(subscription.nextBillingDate, now);
    }
    if (subscription.status === SubscriptionStatus.PAUSED) {
      return now < subscription.currentPeriodEnd;
    }
    return false;
  }

  async getBillingStatus(tenantId: string): Promise<{
    paymentsEnabled: boolean;
    payrollGatewayEnabled: boolean;
    featureGatingEnabled: boolean;
    entitled: boolean;
    needsPayment: boolean;
    subscription: {
      status: SubscriptionStatus;
      plan: string;
      trialEndsAt: Date | null;
      isOnTrial: boolean;
      daysRemaining: number | null;
      currentPeriodEnd: Date;
      nextBillingDate: Date;
    } | null;
  }> {
    const subscription = await this.getTenantSubscription(tenantId);
    if (!subscription) {
      return {
        paymentsEnabled: isBillingGatewayEnabled(),
        payrollGatewayEnabled: isPayrollGatewayEnabled(),
        featureGatingEnabled: isFeatureGatingEnabled(),
        entitled: false,
        needsPayment: true,
        subscription: null,
      };
    }

    let daysRemaining: number | null = null;
    if (subscription.trialEndsAt) {
      const ms = subscription.trialEndsAt.getTime() - Date.now();
      daysRemaining = Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
    }

    const subscriptionSummary = {
      status: subscription.status,
      plan: subscription.plan?.slug ?? subscription.plan?.name ?? 'starter',
      trialEndsAt: subscription.trialEndsAt,
      isOnTrial: subscription.isOnTrial,
      daysRemaining,
      currentPeriodEnd: subscription.currentPeriodEnd,
      nextBillingDate: subscription.nextBillingDate,
    };

    return {
      paymentsEnabled: isBillingGatewayEnabled(),
      payrollGatewayEnabled: isPayrollGatewayEnabled(),
      featureGatingEnabled: isFeatureGatingEnabled(),
      entitled: this.isSubscriptionEntitled(subscription),
      needsPayment: this.computeNeedsPayment(subscriptionSummary),
      subscription: subscriptionSummary,
    };
  }

  computeNeedsPayment(subscription: NeedsPaymentInput): boolean {
    if (!subscription) {
      return true;
    }
    if (
      subscription.status === SubscriptionStatus.EXPIRED ||
      subscription.status === SubscriptionStatus.PAST_DUE ||
      subscription.status === SubscriptionStatus.SUSPENDED ||
      subscription.status === SubscriptionStatus.INACTIVE ||
      subscription.status === SubscriptionStatus.CANCELLED
    ) {
      return true;
    }
    const now = Date.now();
    if (subscription.status === SubscriptionStatus.TRIAL) {
      if (subscription.trialEndsAt) {
        return now >= new Date(subscription.trialEndsAt).getTime();
      }
      return subscription.daysRemaining === 0;
    }
    if (subscription.status === SubscriptionStatus.ACTIVE && subscription.nextBillingDate) {
      return now >= new Date(subscription.nextBillingDate).getTime();
    }
    return false;
  }

  async getCurrentUsage(tenantId: string, usageType: string): Promise<number> {
    const subscription = await this.getTenantSubscription(tenantId);
    if (!subscription?.usageMetrics) return 0;
    const value = subscription.usageMetrics[usageType as keyof typeof subscription.usageMetrics];
    return typeof value === 'number' ? value : 0;
  }
}
