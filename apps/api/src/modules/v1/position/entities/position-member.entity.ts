import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../../common/database/entities/base.entity';
import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';
import { Position } from './position.entity';

@Entity('tenant_member_positions')
export class PositionMember extends BaseEntity {
  @Column({ name: 'tenant_member_id' })
  tenantMemberId: string;
  @ManyToOne(() => TenantMember, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_member_id' })
  member: TenantMember;
  @Column({ name: 'position_id' })
  positionId: string;
  @ManyToOne(() => Position, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'position_id' })
  position: Position;
  @Column({ name: 'assigned_at', type: 'timestamp', nullable: true })
  assignedAt: Date;
  @Column({ name: 'is_current', default: false })
  isCurrent: boolean;
}
