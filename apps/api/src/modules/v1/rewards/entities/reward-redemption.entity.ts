import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../../common/database/entities/base.entity';
import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';

export type RewardType = 'TREMENDOUS' | 'NOMBA_AIRTIME' | 'NOMBA_UTILITY' | 'CUSTOM';
export type RedemptionStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';

export interface RecipientInfo {
  email?: string;
  phone?: string;
}

export interface VoucherInfo {
  code?: string;
  pin?: string;
  instructions?: string;
}

export interface ProviderRefInfo {
  txRef?: string;
  error?: string;
}

@Entity('reward_redemptions')
export class RewardRedemption extends BaseEntity {
  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'member_id', type: 'uuid' })
  memberId: string;

  @ManyToOne(() => TenantMember)
  @JoinColumn({ name: 'member_id' })
  member: TenantMember;

  @Column({ name: 'reward_type', type: 'varchar', length: 24 })
  rewardType: RewardType;

  @Column({ name: 'reward_id', type: 'varchar', nullable: true })
  rewardId: string | null;

  @Column({ name: 'reward_name', type: 'varchar', nullable: true })
  rewardName: string | null;

  @Column({ name: 'points_spent', type: 'int' })
  pointsSpent: number;

  @Column({ name: 'currency_value', type: 'numeric', precision: 14, scale: 2 })
  currencyValue: number;

  @Column({ name: 'currency_code', type: 'varchar', length: 8, default: 'NGN' })
  currencyCode: string;

  @Column({ type: 'varchar', length: 16, default: 'PENDING' })
  status: RedemptionStatus;

  @Column({ type: 'jsonb', nullable: true })
  recipient: RecipientInfo | null;

  @Column({ type: 'jsonb', nullable: true })
  voucher: VoucherInfo | null;

  @Column({ type: 'jsonb', nullable: true })
  providerRef: ProviderRefInfo | null;

  @Column({ name: 'processing_started_at', type: 'timestamptz', nullable: true })
  processingStartedAt: Date | null;
}
