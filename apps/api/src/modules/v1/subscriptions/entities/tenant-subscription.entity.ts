import { SubscriptionStatus } from 'src/common/enums/subscription.enum';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../../common/database/entities/base.entity';
import { Plan } from '../../plans/entities/plan.entity';
import { PlanPrice } from '../../plans/entities/plan-price.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { BillingProvider } from '../constants/billing-provider.enum';

@Entity({ name: 'tenant_subscriptions' })
@Index(['tenantId'], { unique: true })
export class TenantSubscription extends BaseEntity {
  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;
  @Column({ name: 'tenant_id' })
  tenantId: string;
  @ManyToOne(() => Plan, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'plan_id' })
  plan: Plan;
  @Column({ name: 'plan_id' })
  planId: string;
  @ManyToOne(() => PlanPrice, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'plan_price_id' })
  planPrice: PlanPrice;
  @Column({ name: 'plan_price_id' })
  planPriceId: string;
  @Column({
    type: 'varchar',
    default: SubscriptionStatus.TRIAL,
  })
  status: SubscriptionStatus;
  @Column({ name: 'current_users', type: 'integer', default: 0 })
  currentUsers: number;
  @Column({ name: 'trial_ends_at', type: 'timestamp', nullable: true })
  trialEndsAt: Date | null;
  @Column({ name: 'current_period_start', type: 'timestamp' })
  currentPeriodStart: Date;
  @Column({ name: 'current_period_end', type: 'timestamp' })
  currentPeriodEnd: Date;
  @Column({ name: 'next_billing_date', type: 'timestamp' })
  nextBillingDate: Date;
  @Column({ name: 'nomba_subscription_id', type: 'varchar', length: 100, nullable: true })
  nombaSubscriptionId: string | null;
  @Column({
    name: 'billing_provider',
    type: 'varchar',
    length: 16,
    default: BillingProvider.NOMBA,
  })
  billingProvider: BillingProvider;
  @Column({ name: 'external_subscription_id', type: 'varchar', length: 100, nullable: true })
  externalSubscriptionId: string | null;
  @Column({ name: 'noah_customer_id', type: 'varchar', length: 100, nullable: true })
  noahCustomerId: string | null;
  @Column({ name: 'payment_method_id', type: 'varchar', length: 100, nullable: true })
  paymentMethodId: string | null;
  @Column({ name: 'cancel_at_period_end', type: 'boolean', default: false })
  cancelAtPeriodEnd: boolean;
  @Column({ name: 'cancelled_at', type: 'timestamp', nullable: true })
  cancelledAt: Date | null;
  @Column({ name: 'cancellation_reason', type: 'text', nullable: true })
  cancellationReason: string | null;
  @Column({ name: 'paused_at', type: 'timestamp', nullable: true })
  pausedAt: Date | null;
  @Column({ name: 'dunning_attempt_count', type: 'integer', default: 0 })
  dunningAttemptCount: number;
  @Column({ name: 'dunning_next_retry_at', type: 'timestamp', nullable: true })
  dunningNextRetryAt: Date | null;
  @Column({ name: 'last_payment_failure_reason', type: 'varchar', nullable: true })
  lastPaymentFailureReason: string | null;
  @Column({ name: 'last_payment_failure_detail', type: 'text', nullable: true })
  lastPaymentFailureDetail: string | null;
  @Column({ name: 'payment_method_brand', type: 'varchar', nullable: true })
  paymentMethodBrand: string | null;
  @Column({ name: 'payment_method_last_four', type: 'varchar', length: 4, nullable: true })
  paymentMethodLastFour: string | null;
  @Column({ name: 'usage_metrics', type: 'jsonb', nullable: true })
  usageMetrics: {
    activeJobs?: number;
    payrollRuns?: number;
    apiCalls?: number;
    storageUsed?: number;
    integrationsUsed?: number;
    pendingSeatCount?: number;
    pendingExtraSeats?: number;
    pendingChargeAmount?: number;
    pendingSeatChargedAt?: string;
    monnifyWalletCardToken?: string;
    monnifyWalletCardEmail?: string;
  } | null;
  @Column({ name: 'billing_history', type: 'jsonb', nullable: true })
  billingHistory: Array<{
    date: Date;
    amount: number;
    currency: string;
    status: 'paid' | 'pending' | 'failed';
    invoiceId?: string;
    failureReason?: string;
  }> | null;
  get isActive(): boolean {
    return this.status === SubscriptionStatus.ACTIVE;
  }
  get isOnTrial(): boolean {
    return (
      this.status === SubscriptionStatus.TRIAL &&
      this.trialEndsAt !== null &&
      new Date() < this.trialEndsAt
    );
  }
}
