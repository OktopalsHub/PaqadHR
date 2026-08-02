import { Column, Entity, Index } from 'typeorm';
import { PaymentProvider } from 'src/common/enums/payment-provider.enum';
import { BaseEntity } from '../../../../common/database/entities/base.entity';

@Entity('tenant_wallets')
@Index(['tenantId'], { unique: true })
export class TenantWallet extends BaseEntity {
  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'currency_code', type: 'varchar', length: 8, default: 'NGN' })
  currencyCode: string;

  @Column({ name: 'balance_amount', type: 'numeric', precision: 14, scale: 2, default: 0 })
  balanceAmount: number;

  @Column({ name: 'virtual_account_number', type: 'varchar', nullable: true })
  virtualAccountNumber: string | null;

  @Column({ name: 'virtual_account_bank', type: 'varchar', nullable: true })
  virtualAccountBank: string | null;

  @Column({ name: 'virtual_account_name', type: 'varchar', nullable: true })
  virtualAccountName: string | null;

  @Column({ name: 'virtual_account_reference', type: 'varchar', nullable: true })
  virtualAccountReference: string | null;

  @Column({ name: 'virtual_account_provider', type: 'varchar', length: 24, nullable: true })
  virtualAccountProvider: PaymentProvider | null;

  @Column({ name: 'virtual_account_status', type: 'varchar', nullable: true })
  virtualAccountStatus: string | null;

  @Column({ name: 'virtual_account_provisioned_at', type: 'timestamp', nullable: true })
  virtualAccountProvisionedAt: Date | null;

  @Column({ name: 'virtual_account_error', type: 'text', nullable: true })
  virtualAccountError: string | null;

  @Column({ name: 'points_exchange_rate', type: 'numeric', precision: 10, scale: 2, default: 1 })
  pointsExchangeRate: number;

  @Column({ name: 'auto_topup_enabled', default: false })
  autoTopupEnabled: boolean;

  @Column({ name: 'auto_topup_threshold', type: 'numeric', precision: 14, scale: 2, default: 0 })
  autoTopupThreshold: number;

  @Column({ name: 'auto_topup_amount', type: 'numeric', precision: 14, scale: 2, default: 0 })
  autoTopupAmount: number;
}
