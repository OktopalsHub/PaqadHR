import { LeaveStatus } from 'src/common/enums';
import {
  Column,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne } from 'typeorm';
import { LeaveType } from "../../leave-type/entities/leave-type.entity";
import { TenantMember } from "../../tenant-members/entities/tenant-member.entity";
import { Tenant } from "../../tenants/entities/tenant.entity";
import { BaseEntity } from "../../../../common/database/entities/base.entity";

@Entity('leaves')
export class Leave extends BaseEntity {
  @Column({ name: 'reviewed_at', type: 'timestamp', nullable: true })
  reviewedAt?: Date;
  @Column({ nullable: true })
  comments?: string;
  @Column({ type: 'int' })
  duration: number;
  @Column({ name: 'leave_type_id' })
  leaveTypeId: string;
  @ManyToOne(() => LeaveType, (leaveType) => leaveType.leaves)
  @JoinColumn({ name: 'leave_type_id' })
  leaveTypes: LeaveType;
  @Column({ name: 'start_date', type: 'date' })
  startDate: Date;
  @Column({ name: 'end_date', type: 'date' })
  endDate: Date;
  @Column({
    type: 'enum',
    enum: LeaveStatus,
    default: LeaveStatus.PENDING,
  })
  status: LeaveStatus;
  @Column({ nullable: true })
  reason: string;
  @Column({ name: 'approved_by', nullable: true })
  approvedBy?: string;
  @ManyToOne(
    () => TenantMember,
    (tenantMember) => tenantMember.approvedLeaves,
    {
      nullable: true,
    },
  )
  @JoinColumn({ name: 'approved_by' })
  approver?: TenantMember;
  @Column({ name: 'requested_by' })
  requestedBy: string;
  @ManyToOne(() => TenantMember, (tenantMember) => tenantMember.requestedLeaves)
  @JoinColumn({ name: 'requested_by' })
  requester: TenantMember;
  @Column({ name: 'tenant_id' })
  tenantId: string;
  @ManyToOne(() => Tenant, (tenant) => tenant.leaves)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;
  @DeleteDateColumn({
    name: 'deleted_at',
    type: 'timestamp',
    nullable: true,
  })
  deletedAt: Date;
}
