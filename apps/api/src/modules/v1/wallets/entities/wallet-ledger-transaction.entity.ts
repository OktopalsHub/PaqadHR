import { Column, Entity, Index } from 'typeorm';

import { BaseEntity } from '../../../../common/database/entities/base.entity';

@Entity({ name: 'wallet_ledger_transactions' })
@Index('uq_wallet_ledger_transactions_idempotency', ['idempotencyKey'], { unique: true })
export class WalletLedgerTransaction extends BaseEntity {
  @Column({ type: 'varchar', length: 32 })
  kind: string;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status: 'pending' | 'posted' | 'reversed';

  @Column({ name: 'idempotency_key', type: 'varchar', length: 255 })
  idempotencyKey: string;

  @Column({ type: 'varchar', length: 24, nullable: true })
  provider: string | null;

  @Column({ name: 'provider_reference', type: 'varchar', length: 255, nullable: true })
  providerReference: string | null;

  @Column({ name: 'reverses_transaction_id', type: 'uuid', nullable: true })
  reversesTransactionId: string | null;

  @Column({ name: 'occurred_at', type: 'timestamp', nullable: true })
  occurredAt: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  evidence: Record<string, unknown> | null;
}
