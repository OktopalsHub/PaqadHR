import { Column, Entity, Index } from 'typeorm';

import { BaseEntity } from '../../../../common/database/entities/base.entity';

@Entity({ name: 'provider_external_accounts' })
@Index('uq_provider_external_accounts_method', ['paymentMethodId'], { unique: true })
@Index('uq_provider_external_accounts_provider_id', ['provider', 'providerExternalAccountId'], {
  unique: true,
})
@Index('ix_provider_external_accounts_owner', ['tenantId', 'userId', 'currency'])
export class ProviderExternalAccount extends BaseEntity {
  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'member_id', type: 'uuid' })
  memberId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'payment_method_id', type: 'uuid' })
  paymentMethodId: string;

  @Column({ name: 'provider_customer_id', type: 'uuid' })
  providerCustomerId: string;

  @Column({ type: 'varchar', length: 24 })
  provider: string;

  @Column({ name: 'provider_external_account_id', type: 'varchar', length: 255 })
  providerExternalAccountId: string;

  @Column({ type: 'varchar', length: 10 })
  currency: 'USD' | 'EUR' | 'GBP';

  @Column({ type: 'varchar', length: 2 })
  country: string;

  @Column({ name: 'source_currency', type: 'varchar', length: 10 })
  sourceCurrency: 'USDC' | 'USDT';

  @Column({ type: 'varchar', length: 32 })
  network: string;

  @Column({ type: 'varchar', length: 24, default: 'pending' })
  status: string;

  @Column({ type: 'varchar', length: 64 })
  fingerprint: string;
}
