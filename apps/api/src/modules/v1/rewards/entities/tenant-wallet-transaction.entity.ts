import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../../common/database/entities/base.entity';
import { TenantWallet } from './tenant-wallet.entity';

@Entity('tenant_wallet_transactions')
export class TenantWalletTransaction extends BaseEntity {
  @Column({ name: 'tenant_wallet_id', type: 'uuid' })
  tenantWalletId: string;

  @ManyToOne(() => TenantWallet)
  @JoinColumn({ name: 'tenant_wallet_id' })
  wallet: TenantWallet;

  @Column({ type: 'varchar', length: 16 })
  type: 'DEPOSIT' | 'SPENT' | 'REFUND';

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', nullable: true })
  reference: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 16, default: 'COMPLETED' })
  status: 'COMPLETED' | 'PENDING' | 'PARTIAL' | 'REJECTED';

  @Column({ name: 'raw_amount', type: 'numeric', precision: 14, scale: 2, nullable: true })
  rawAmount: number | null;

  @Column({ name: 'provider_event_id', type: 'varchar', nullable: true })
  providerEventId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;
}
