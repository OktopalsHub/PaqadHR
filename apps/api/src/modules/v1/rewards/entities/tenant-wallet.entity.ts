import { Column, Entity, Index } from 'typeorm';
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

  @Column({ name: 'points_exchange_rate', type: 'numeric', precision: 10, scale: 2, default: 1 })
  pointsExchangeRate: number;

  @Column({ name: 'auto_topup_enabled', default: false })
  autoTopupEnabled: boolean;

  @Column({ name: 'auto_topup_threshold', type: 'numeric', precision: 14, scale: 2, default: 0 })
  autoTopupThreshold: number;

  @Column({ name: 'auto_topup_amount', type: 'numeric', precision: 14, scale: 2, default: 0 })
  autoTopupAmount: number;
}
