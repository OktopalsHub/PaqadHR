import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../../common/database/entities/base.entity';
import { Department } from '../../departments/entities/department.entity';
import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { TeamMember } from './team-member.entity';

@Entity('teams')
export class Team extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  name: string;
  @Column({ type: 'text', nullable: true })
  description?: string;
  @Column({ type: 'uuid', nullable: true, name: 'department_id' })
  departmentId?: string;
  @ManyToOne(
    () => Department,
    (department) => department.teams,
    {
      nullable: true,
    },
  )
  @JoinColumn({ name: 'department_id' })
  department?: Department;
  @Column({ type: 'uuid', nullable: true, name: 'lead_id' })
  leadId?: string;
  @ManyToOne(() => TenantMember, { nullable: true })
  @JoinColumn({ name: 'lead_id' })
  lead?: TenantMember;
  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId: string;
  @ManyToOne(
    () => Tenant,
    (tenant) => tenant.teams,
  )
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;
  @Column({ type: 'uuid', name: 'created_by' })
  createdBy: string;
  @OneToMany(
    () => TeamMember,
    (member) => member.team,
  )
  members?: TeamMember[];
}
