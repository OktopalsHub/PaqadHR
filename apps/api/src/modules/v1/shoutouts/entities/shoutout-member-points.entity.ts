import { Column, DeleteDateColumn, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../../common/database/entities/base.entity';
import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';

@Entity('shoutout_member_points')
export class ShoutoutMemberPoints extends BaseEntity {
  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'member_id', type: 'uuid' })
  memberId: string;

  @ManyToOne(() => TenantMember)
  @JoinColumn({ name: 'member_id' })
  member: TenantMember;

  @Column({ name: 'total_earned', type: 'int', default: 0 })
  totalEarned: number;

  @Column({ name: 'total_given', type: 'int', default: 0 })
  totalGiven: number;

  @Column({ name: 'current_balance', type: 'int', default: 0 })
  currentBalance: number;

  @Column({ name: 'monthly_given', type: 'int', default: 0 })
  monthlyGiven: number;

  @Column({ name: 'monthly_received', type: 'int', default: 0 })
  monthlyReceived: number;

  @Column({ name: 'last_reset_date', type: 'timestamp', nullable: true })
  lastResetDate: Date | null;
  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}
