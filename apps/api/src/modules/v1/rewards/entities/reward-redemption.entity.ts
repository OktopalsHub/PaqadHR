import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../../common/database/entities/base.entity';
import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';

export type RewardType =
  | 'TREMENDOUS'
  | 'NOMBA_AIRTIME'
  | 'NOMBA_UTILITY'
  | 'MONNIFY_AIRTIME'
  | 'MONNIFY_UTILITY'
  | 'CUSTOM';
export type RedemptionStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';

export const NG_AIRTIME_REWARD_TYPES: readonly RewardType[] = [
  'NOMBA_AIRTIME',
  'MONNIFY_AIRTIME',
] as const;
export const NG_UTILITY_REWARD_TYPES: readonly RewardType[] = [
  'NOMBA_UTILITY',
  'MONNIFY_UTILITY',
] as const;
export const NG_REWARD_TYPES: readonly RewardType[] = [
  ...NG_AIRTIME_REWARD_TYPES,
  ...NG_UTILITY_REWARD_TYPES,
] as const;

export function isNgAirtimeRewardType(value: string): boolean {
  return (NG_AIRTIME_REWARD_TYPES as readonly string[]).includes(value);
}
export function isNgUtilityRewardType(value: string): boolean {
  return (NG_UTILITY_REWARD_TYPES as readonly string[]).includes(value);
}
export function isNgRewardType(value: string): boolean {
  return (NG_REWARD_TYPES as readonly string[]).includes(value);
}

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
