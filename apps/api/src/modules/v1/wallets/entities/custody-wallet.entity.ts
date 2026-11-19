import { Column, Entity, Index } from 'typeorm';

import { BaseEntity } from '../../../../common/database/entities/base.entity';
import { WalletOwnerType } from './provider-customer.entity';

@Entity({ name: 'custody_wallets' })
@Index('uq_custody_wallets_provider_wallet', ['provider', 'providerWalletId'], { unique: true })
export class CustodyWallet extends BaseEntity {
  @Column({ name: 'owner_type', type: 'varchar', length: 16 })
  ownerType: WalletOwnerType;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId: string | null;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ name: 'provider_customer_id', type: 'uuid' })
  providerCustomerId: string;

  @Column({ type: 'varchar', length: 24 })
  provider: string;

  @Column({ name: 'provider_wallet_id', type: 'varchar', length: 255 })
  providerWalletId: string;

  @Column({ type: 'varchar', length: 32 })
  network: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  address: string | null;

  @Column({ type: 'varchar', length: 24, default: 'pending' })
  status: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;
}
