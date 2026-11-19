import { Column, Entity, Index } from 'typeorm';

import { BaseEntity } from '../../../../common/database/entities/base.entity';
import { WalletOwnerType } from './provider-customer.entity';

@Entity({ name: 'wallet_fundings' })
@Index(
  'uq_wallet_fundings_provider_deposit',
  ['provider', 'virtualAccountId', 'providerDepositId'],
  { unique: true },
)
@Index('ix_wallet_fundings_owner_created', ['tenantId', 'createdAt'])
export class WalletFunding extends BaseEntity {
  @Column({ name: 'owner_type', type: 'varchar', length: 16 })
  ownerType: WalletOwnerType;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId: string | null;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ name: 'virtual_account_id', type: 'uuid' })
  virtualAccountId: string;

  @Column({ type: 'varchar', length: 24 })
  provider: string;

  @Column({ name: 'provider_deposit_id', type: 'varchar', length: 255 })
  providerDepositId: string;

  @Column({ type: 'varchar', length: 24 })
  status: string;

  @Column({ name: 'source_amount', type: 'numeric', precision: 30, scale: 12, nullable: true })
  sourceAmount: string | null;

  @Column({ name: 'source_currency', type: 'varchar', length: 10 })
  sourceCurrency: string;

  @Column({ name: 'destination_amount', type: 'numeric', precision: 30, scale: 12, nullable: true })
  destinationAmount: string | null;

  @Column({ name: 'destination_currency', type: 'varchar', length: 10 })
  destinationCurrency: string;

  @Column({ type: 'varchar', length: 32 })
  network: string;

  @Column({ name: 'occurred_at', type: 'timestamp' })
  occurredAt: Date;

  @Column({ name: 'ledger_transaction_id', type: 'uuid', nullable: true })
  ledgerTransactionId: string | null;

  @Column({ name: 'reversal_transaction_id', type: 'uuid', nullable: true })
  reversalTransactionId: string | null;
}
