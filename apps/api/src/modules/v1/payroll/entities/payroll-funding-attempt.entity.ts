import { Column, Entity, Index } from 'typeorm';

import { BaseEntity } from '../../../../common/database/entities/base.entity';

export type PayrollFundingPurpose = 'run_funding' | 'retry_shortfall';
export type PayrollFundingAttemptStatus =
  | 'created'
  | 'pending'
  | 'processing'
  | 'confirmed'
  | 'reversed'
  | 'failed'
  | 'cancelled'
  | 'expired'
  | 'requires_review';

@Entity({ name: 'payroll_funding_attempts' })
@Index('uq_payroll_funding_attempt_idempotency', ['idempotencyKey'], { unique: true })
@Index('uq_payroll_funding_attempt_provider_ref', ['provider', 'orderReference'], { unique: true })
@Index('uq_payroll_funding_attempt_provider_reference', ['provider', 'providerReference'], {
  unique: true,
  where: '"provider_reference" IS NOT NULL',
})
@Index('uq_payroll_funding_attempt_run_number', ['payrollRunId', 'purpose', 'attemptNumber'], {
  unique: true,
})
@Index('ix_payroll_funding_attempt_tenant_status', ['tenantId', 'status', 'createdAt'])
export class PayrollFundingAttempt extends BaseEntity {
  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'payroll_run_id', type: 'uuid' })
  payrollRunId: string;

  @Column({ type: 'varchar', length: 24 })
  purpose: PayrollFundingPurpose;

  @Column({ name: 'attempt_number', type: 'integer' })
  attemptNumber: number;

  @Column({ type: 'varchar', length: 24 })
  provider: string;

  @Column({ type: 'varchar', length: 24, default: 'created' })
  status: PayrollFundingAttemptStatus;

  @Column({ name: 'order_reference', type: 'varchar', length: 255 })
  orderReference: string;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 255 })
  idempotencyKey: string;

  @Column({ type: 'varchar', length: 10 })
  currency: string;

  @Column({ type: 'numeric', precision: 30, scale: 12 })
  amount: string;

  @Column({ name: 'checkout_amount', type: 'numeric', precision: 30, scale: 12, nullable: true })
  checkoutAmount: string | null;

  @Column({ name: 'balance_applied', type: 'numeric', precision: 30, scale: 12, nullable: true })
  balanceApplied: string | null;

  @Column({ name: 'selected_item_ids', type: 'jsonb', nullable: true })
  selectedItemIds: string[] | null;

  @Column({ name: 'provider_reference', type: 'varchar', length: 255, nullable: true })
  providerReference: string | null;

  @Column({ name: 'created_by_id', type: 'uuid', nullable: true })
  createdById: string | null;

  @Column({ name: 'confirmed_at', type: 'timestamp', nullable: true })
  confirmedAt: Date | null;

  @Column({ name: 'cancelled_at', type: 'timestamp', nullable: true })
  cancelledAt: Date | null;

  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;
}
