import { SubscriptionStatus } from 'src/common/enums/subscription.enum';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../../common/database/entities/base.entity';
import { Plan } from '../../plans/entities/plan.entity';
import { PlanPrice } from '../../plans/entities/plan-price.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';

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
  @Column({ name: 'payment_method_id', type: 'varchar', length: 100, nullable: true })
  paymentMethodId: string | null;
  @Column({ name: 'usage_metrics', type: 'jsonb', nullable: true })
  usageMetrics: {
    activeJobs?: number;
    payrollRuns?: number;
    apiCalls?: number;
    storageUsed?: number;
    integrationsUsed?: number;
  } | null;
  @Column({ name: 'billing_history', type: 'jsonb', nullable: true })
  billingHistory: Array<{
    date: Date;
    amount: number;
    currency: string;
    status: 'paid' | 'pending' | 'failed';
    invoiceId?: string;
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
