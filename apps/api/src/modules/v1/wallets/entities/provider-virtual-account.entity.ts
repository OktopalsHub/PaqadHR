import { Column, Entity, Index } from 'typeorm';

import { BaseEntity } from '../../../../common/database/entities/base.entity';
import { WalletOwnerType } from './provider-customer.entity';

@Entity({ name: 'provider_virtual_accounts' })
@Index('uq_provider_virtual_accounts_provider_id', ['provider', 'providerVirtualAccountId'], {
  unique: true,
})
export class ProviderVirtualAccount extends BaseEntity {
  @Column({ name: 'owner_type', type: 'varchar', length: 16 })
  ownerType: WalletOwnerType;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId: string | null;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ name: 'provider_customer_id', type: 'uuid' })
  providerCustomerId: string;

  @Column({ name: 'custody_wallet_id', type: 'uuid' })
  custodyWalletId: string;

  @Column({ type: 'varchar', length: 24 })
  provider: string;

  @Column({ name: 'provider_virtual_account_id', type: 'varchar', length: 255 })
  providerVirtualAccountId: string;

  @Column({ name: 'source_currency', type: 'varchar', length: 10 })
  sourceCurrency: string;

  @Column({ name: 'destination_currency', type: 'varchar', length: 10 })
  destinationCurrency: string;

  @Column({ type: 'varchar', length: 32 })
  network: string;

  @Column({ type: 'varchar', length: 24, default: 'pending' })
  status: string;
}
