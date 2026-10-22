import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../../common/database/entities/base.entity';

export enum PayrollFundingLedgerEventType {
  FUNDING_RECEIVED = 'funding_received',
  PAYOUT_RESERVED = 'payout_reserved',
  PAYOUT_CONFIRMED = 'payout_confirmed',
  RESERVATION_RELEASED = 'reservation_released',
  SHORTFALL_APPROVED = 'shortfall_approved',
  SHORTFALL_CANCELLED = 'shortfall_cancelled',
}

@Entity({ name: 'payroll_run_funding_ledger' })
@Index('ix_payroll_run_funding_ledger_run_created', ['payrollRunId', 'createdAt'])
@Index('ix_payroll_run_funding_ledger_tenant_run', ['tenantId', 'payrollRunId'])
export class PayrollRunFundingLedgerEntry extends BaseEntity {
  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'payroll_run_id', type: 'uuid' })
  payrollRunId: string;

  @Column({ name: 'payroll_item_id', type: 'uuid', nullable: true })
  payrollItemId: string | null;

  @Column({ name: 'event_type', type: 'varchar', length: 32 })
  eventType: PayrollFundingLedgerEventType;

  /** Positive amount in the ledger currency. Entries are append-only. */
  @Column({ type: 'numeric', precision: 15, scale: 2 })
  amount: string;

  @Column({ type: 'varchar', length: 10 })
  currency: string;

  @Column({ type: 'varchar', length: 32 })
  provider: string;

  @Column({ name: 'provider_reference', type: 'varchar', length: 255, nullable: true })
  providerReference: string | null;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 255, unique: true })
  idempotencyKey: string;

  @Column({ name: 'performed_by_id', type: 'uuid', nullable: true })
  performedById: string | null;

  @Column({ name: 'approved_by_id', type: 'uuid', nullable: true })
  approvedById: string | null;

  @Column({ type: 'jsonb', nullable: true })
  evidence: Record<string, string | number | boolean | null> | null;
}
