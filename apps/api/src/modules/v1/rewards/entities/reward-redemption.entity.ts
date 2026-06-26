import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../../common/database/entities/base.entity';
import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';

export type RewardType = 'RELOADLY' | 'NOMBA_AIRTIME' | 'CUSTOM';
export type RedemptionStatus = 'PENDING' | 'SUCCESS' | 'FAILED';

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

  @Column({ name: 'recipient_email', type: 'varchar', nullable: true })
  recipientEmail: string | null;

  @Column({ name: 'recipient_phone', type: 'varchar', nullable: true })
  recipientPhone: string | null;

  @Column({ name: 'voucher_code', type: 'text', nullable: true })
  voucherCode: string | null;

  @Column({ name: 'voucher_pin', type: 'text', nullable: true })
  voucherPin: string | null;

  @Column({ name: 'voucher_instructions', type: 'text', nullable: true })
  voucherInstructions: string | null;

  @Column({ name: 'provider_tx_ref', type: 'varchar', nullable: true })
  providerTxRef: string | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;
}
