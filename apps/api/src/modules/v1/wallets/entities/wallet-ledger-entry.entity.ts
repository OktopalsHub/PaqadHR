import { Column, Entity, Index } from 'typeorm';

import { BaseEntity } from '../../../../common/database/entities/base.entity';

@Entity({ name: 'wallet_ledger_entries' })
@Index('ix_wallet_ledger_entries_account_created', ['accountId', 'createdAt'])
export class WalletLedgerEntry extends BaseEntity {
  @Column({ name: 'transaction_id', type: 'uuid' })
  transactionId: string;

  @Column({ name: 'account_id', type: 'uuid' })
  accountId: string;

  @Column({ type: 'varchar', length: 6 })
  direction: 'debit' | 'credit';

  /** Exact decimal string; posted values are positive and currency-scoped. */
  @Column({ type: 'numeric', precision: 30, scale: 12 })
  amount: string;

  @Column({ type: 'varchar', length: 10 })
  currency: string;
}
