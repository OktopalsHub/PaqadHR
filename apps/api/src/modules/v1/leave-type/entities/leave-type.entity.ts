import {
  Column,
  DeleteDateColumn,
  Entity,
  ManyToOne,
  OneToMany } from 'typeorm';
import { Tenant } from "../../tenants/entities/tenant.entity";
import { TenantMember } from "../../tenant-members/entities/tenant-member.entity";
import { Leave } from "../../leave/entities/leave.entity";
import { LeaveBalance } from "../../leave-balance/entities/leave-balance.entity";
import { BaseEntity } from "../../../../common/database/entities/base.entity";

@Entity('leave_types')
export class LeaveType extends BaseEntity {
  @Column()
  name: string;
  @Column()
  description: string;
  @Column({ name: 'default_days' })
  defaultDays: number;
  @Column({ name: 'is_active', default: true })
  isActive: boolean;
  @Column({ name: 'tenant_id' })
  tenantId: string;
  @ManyToOne(() => Tenant, (tenant) => tenant.leaveTypes)
  tenant: Tenant;
  @Column({ name: 'tenant_member_id' })
  tenantMemberId: string;
  @ManyToOne(() => TenantMember, (tenantMember) => tenantMember.leaveTypes)
  tenantMember: TenantMember;
  @OneToMany(() => Leave, (leave) => leave.leaveTypes)
  leaves: Leave[];
  @OneToMany(() => LeaveBalance, (leaveBalance) => leaveBalance.leaveType)
  leaveBalances: Leave[];
  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt: Date;
}
