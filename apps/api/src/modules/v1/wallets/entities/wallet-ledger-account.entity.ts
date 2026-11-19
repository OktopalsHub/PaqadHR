import { Column, Entity } from 'typeorm';

import { BaseEntity } from '../../../../common/database/entities/base.entity';

@Entity({ name: 'wallet_ledger_accounts' })
export class WalletLedgerAccount extends BaseEntity {
  @Column({ name: 'owner_type', type: 'varchar', length: 16 })
  ownerType: 'organization' | 'employee' | 'system';

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId: string | null;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ name: 'account_type', type: 'varchar', length: 24 })
  accountType: 'available' | 'reserved' | 'clearing' | 'fee' | 'custody' | 'revenue';

  @Column({ name: 'normal_side', type: 'varchar', length: 6 })
  normalSide: 'debit' | 'credit';

  @Column({ type: 'varchar', length: 10 })
  currency: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  network: string | null;

  @Column({ type: 'varchar', length: 16, default: 'active' })
  status: string;
}
