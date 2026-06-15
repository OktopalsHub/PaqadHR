import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../../common/database/entities/base.entity';
import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';
import { Department } from './department.entity';

@Entity('department_members')
export class DepartmentMember extends BaseEntity {
  @Column({ type: 'uuid', name: 'department_id' })
  departmentId: string;
  @ManyToOne(
    () => Department,
    (department) => department.departmentMembers,
  )
  @JoinColumn({ name: 'department_id' })
  department: Department;
  @Column({ type: 'uuid', name: 'member_id' })
  memberId: string;
  @ManyToOne(
    () => TenantMember,
    (member) => member.departmentMemberships,
  )
  @JoinColumn({ name: 'member_id' })
  member: TenantMember;
  @Column({ type: 'varchar', length: 50, nullable: true })
  role?: string;
  @Column({ type: 'date', nullable: true })
  joinedAt?: Date;
  @Column({ type: 'boolean', default: true })
  isActive: boolean;
}
