import type { ShoutoutPointTransactionType } from 'src/common/enums/shoutout-point-transaction-type.enum';
import { Column, DeleteDateColumn, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../../common/database/entities/base.entity';
import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';
import { Shoutout } from './shoutout.entity';

@Entity('shoutout_point_transactions')
export class ShoutoutPointTransaction extends BaseEntity {
  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'member_id', type: 'uuid' })
  memberId: string;

  @ManyToOne(() => TenantMember)
  @JoinColumn({ name: 'member_id' })
  member: TenantMember;

  @Column({ type: 'varchar', length: 16 })
  type: ShoutoutPointTransactionType;

  @Column({ type: 'int' })
  points: number;

  @Column({ name: 'running_balance', type: 'int' })
  runningBalance: number;

  @Column({ name: 'shoutout_id', type: 'uuid', nullable: true })
  shoutoutId: string | null;

  @ManyToOne(() => Shoutout, { nullable: true })
  @JoinColumn({ name: 'shoutout_id' })
  shoutout: Shoutout | null;

  @Column({ type: 'varchar', nullable: true })
  description: string | null;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy: string;
  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}
