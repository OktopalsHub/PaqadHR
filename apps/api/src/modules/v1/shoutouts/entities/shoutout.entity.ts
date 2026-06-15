import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../../common/database/entities/base.entity';
import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';
import { ShoutoutCategoryAssignment } from './shoutout-category-assignment.entity';
import { ShoutoutRecipient } from './shoutout-recipient.entity';

@Entity('shoutouts')
export class Shoutout extends BaseEntity {
  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'total_points', type: 'int', default: 0 })
  totalPoints: number;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy: string;

  @ManyToOne(() => TenantMember)
  @JoinColumn({ name: 'created_by' })
  creator: TenantMember;

  @Column({ type: 'text' })
  message: string;

  @OneToMany(
    () => ShoutoutRecipient,
    (recipient) => recipient.shoutout,
  )
  recipients: ShoutoutRecipient[];

  @OneToMany(
    () => ShoutoutCategoryAssignment,
    (assignment) => assignment.shoutout,
  )
  categoryAssignments: ShoutoutCategoryAssignment[];
}
