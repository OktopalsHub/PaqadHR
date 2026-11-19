import { Column, Entity, Index } from 'typeorm';

import { BaseEntity } from '../../../../common/database/entities/base.entity';

export type PayrollPayoutAttemptStatus =
  | 'created'
  | 'processing'
  | 'payment_processed'
  | 'failed'
  | 'requires_review'
  | 'reversed';

@Entity({ name: 'payroll_payout_attempts' })
@Index('uq_payroll_payout_attempt_idempotency', ['idempotencyKey'], { unique: true })
@Index(
  'uq_payroll_payout_attempt_item_provider_number',
  ['payrollItemId', 'provider', 'attemptNumber'],
  {
    unique: true,
  },
)
@Index('ix_payroll_payout_attempt_tenant_status', ['tenantId', 'status', 'createdAt'])
@Index('uq_payroll_payout_attempt_provider_merchant_ref', ['provider', 'merchantReference'], {
  unique: true,
  where: '"merchant_reference" IS NOT NULL',
})
@Index('uq_payroll_payout_attempt_provider_reference', ['provider', 'providerReference'], {
  unique: true,
  where: '"provider_reference" IS NOT NULL',
})
export class PayrollPayoutAttempt extends BaseEntity {
  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'payroll_run_id', type: 'uuid' })
  payrollRunId: string;

  @Column({ name: 'payroll_item_id', type: 'uuid' })
  payrollItemId: string;

  @Column({ name: 'attempt_number', type: 'integer' })
  attemptNumber: number;

  @Column({ type: 'varchar', length: 24 })
  provider: string;

  @Column({ type: 'varchar', length: 24, default: 'created' })
  status: PayrollPayoutAttemptStatus;

  @Column({ name: 'merchant_reference', type: 'varchar', length: 255, nullable: true })
  merchantReference: string | null;

  @Column({ name: 'provider_reference', type: 'varchar', length: 255, nullable: true })
  providerReference: string | null;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 255 })
  idempotencyKey: string;

  @Column({ name: 'source_amount', type: 'numeric', precision: 30, scale: 12, nullable: true })
  sourceAmount: string | null;

  @Column({ name: 'source_currency', type: 'varchar', length: 10, nullable: true })
  sourceCurrency: string | null;

  @Column({ name: 'destination_amount', type: 'numeric', precision: 30, scale: 12 })
  destinationAmount: string;

  @Column({ name: 'destination_currency', type: 'varchar', length: 10 })
  destinationCurrency: string;

  @Column({ name: 'submitted_at', type: 'timestamp', nullable: true })
  submittedAt: Date | null;

  @Column({ name: 'settled_at', type: 'timestamp', nullable: true })
  settledAt: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;
}
