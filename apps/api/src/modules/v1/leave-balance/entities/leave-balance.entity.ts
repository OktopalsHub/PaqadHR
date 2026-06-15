import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../../common/database/entities/base.entity';
import { LeaveType } from '../../leave-type/entities/leave-type.entity';
import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';

@Entity('leave_balances')
export class LeaveBalance extends BaseEntity {
  @Column({ name: 'member_id' })
  memberId: string;
  @ManyToOne(
    () => TenantMember,
    (member) => member.leaveBalances,
  )
  @JoinColumn({ name: 'member_id' })
  tenantMember: TenantMember;
  @Column({ name: 'leave_type_id' })
  leaveTypeId: string;
  @ManyToOne(
    () => LeaveType,
    (member) => member.leaveBalances,
  )
  @JoinColumn({ name: 'leave_type_id' })
  leaveType: LeaveType;
  @Column({ name: 'total_days' })
  totalDays: number;
  @Column({ name: 'used_days' })
  usedDays: number;
  @Column({ name: 'remaining_days' })
  remainingDays: number;
  @Column({ name: 'carryover_days', default: 0 })
  carryoverDays: number;
  @Column({ name: 'regular_days' })
  regularDays: number;
  @Column({ name: 'carryover_expiry_date', nullable: true, type: 'date' })
  carryoverExpiryDate?: Date | null;
  @Column({ name: 'carryover_used', default: 0 })
  carryoverUsed: number;
  @Column()
  year: number;
  @Column({ name: 'tenant_id' })
  tenantId: string;
  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;
}
