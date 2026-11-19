import { Column, Entity, Index } from 'typeorm';

import { BaseEntity } from '../../../../common/database/entities/base.entity';

export type WalletOwnerType = 'organization' | 'employee';

@Entity({ name: 'wallet_provider_customers' })
@Index('uq_wallet_provider_customers_provider_customer', ['provider', 'providerCustomerId'], {
  unique: true,
})
export class ProviderCustomer extends BaseEntity {
  @Column({ name: 'owner_type', type: 'varchar', length: 16 })
  ownerType: WalletOwnerType;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId: string | null;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ type: 'varchar', length: 24 })
  provider: string;

  @Column({ name: 'provider_customer_id', type: 'varchar', length: 255, nullable: true })
  providerCustomerId: string | null;

  @Column({ name: 'provider_kyc_link_id', type: 'varchar', length: 255, nullable: true })
  providerKycLinkId: string | null;

  @Column({ type: 'varchar', length: 24, default: 'pending' })
  status: string;

  @Column({ name: 'kyc_status', type: 'varchar', length: 24, nullable: true })
  kycStatus: string | null;

  @Column({ name: 'kyb_status', type: 'varchar', length: 24, nullable: true })
  kybStatus: string | null;

  @Column({ name: 'terms_status', type: 'varchar', length: 24, nullable: true })
  termsStatus: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;
}
