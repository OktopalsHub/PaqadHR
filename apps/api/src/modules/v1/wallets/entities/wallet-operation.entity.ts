import { Column, Entity, Index } from 'typeorm';

import { BaseEntity } from '../../../../common/database/entities/base.entity';

@Entity({ name: 'wallet_operations' })
@Index('uq_wallet_operations_idempotency', ['idempotencyKey'], { unique: true })
@Index('ix_wallet_operations_tenant_created', ['tenantId', 'createdAt'])
export class WalletOperation extends BaseEntity {
  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'payroll_run_id', type: 'uuid', nullable: true })
  payrollRunId: string | null;

  @Column({ name: 'payroll_item_id', type: 'uuid', nullable: true })
  payrollItemId: string | null;

  @Column({ name: 'source_wallet_id', type: 'uuid', nullable: true })
  sourceWalletId: string | null;

  @Column({ name: 'destination_wallet_id', type: 'uuid', nullable: true })
  destinationWalletId: string | null;

  @Column({ type: 'varchar', length: 24 })
  provider: string;

  @Column({ type: 'varchar', length: 24 })
  kind: string;

  @Column({ type: 'varchar', length: 24, default: 'created' })
  status: string;

  @Column({ name: 'source_amount', type: 'numeric', precision: 30, scale: 12 })
  sourceAmount: string;

  @Column({ name: 'source_currency', type: 'varchar', length: 10 })
  sourceCurrency: string;

  @Column({ name: 'destination_amount', type: 'numeric', precision: 30, scale: 12, nullable: true })
  destinationAmount: string | null;

  @Column({ name: 'destination_currency', type: 'varchar', length: 10, nullable: true })
  destinationCurrency: string | null;

  @Column({ name: 'network', type: 'varchar', length: 32, nullable: true })
  network: string | null;

  @Column({ name: 'exchange_rate', type: 'numeric', precision: 30, scale: 12, nullable: true })
  exchangeRate: string | null;

  @Column({ name: 'provider_reference', type: 'varchar', length: 255, nullable: true })
  providerReference: string | null;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 255 })
  idempotencyKey: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;
}
