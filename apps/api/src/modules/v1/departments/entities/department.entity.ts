import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany } from 'typeorm';
import { DepartmentMember } from './department-member.entity';
import { TenantMember } from "../../tenant-members/entities/tenant-member.entity";
import { Team } from "../../teams/entities/team.entity";
import { Tenant } from "../../tenants/entities/tenant.entity";
import { BaseEntity } from "../../../../common/database/entities/base.entity";

@Entity('departments')
export class Department extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  name: string;
  @Column({ type: 'text', nullable: true })
  description?: string;
  @Column({ type: 'uuid', nullable: true, name: 'manager_id' })
  managerId?: string;
  @ManyToOne(() => TenantMember, {
    nullable: true,
  })
  @JoinColumn({ name: 'manager_id' })
  manager?: TenantMember;
  @Column({ type: 'uuid', nullable: true, name: 'parent_id' })
  parentId?: string;
  @ManyToOne(() => Department, (department) => department.children, {
    nullable: true,
  })
  @JoinColumn({ name: 'parent_id' })
  parent?: Department;
  @OneToMany(() => Department, (department) => department.parent)
  children?: Department[];
  @OneToMany(() => Team, (team) => team.department)
  teams?: Team[];
  @OneToMany(() => DepartmentMember, (member) => member.department)
  departmentMembers?: DepartmentMember[];
  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId: string;
  @ManyToOne(() => Tenant, (tenant) => tenant.departments)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;
  @Column({ type: 'uuid', name: 'created_by' })
  createdBy: string;
}
