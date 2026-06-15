import { EAttendanceExceptionStatus, EAttendanceExceptionType } from 'src/common/enums';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../../common/database/entities/base.entity';
import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';

@Entity('attendance_exceptions')
export class AttendanceException extends BaseEntity {
  @Column({ type: 'date' })
  date: Date;
  @Column({ type: 'enum', enum: EAttendanceExceptionType })
  type: EAttendanceExceptionType;
  @Column()
  reason: string;
  @Column({
    type: 'enum',
    enum: EAttendanceExceptionStatus,
    default: EAttendanceExceptionStatus.PENDING,
  })
  status: EAttendanceExceptionStatus;
  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt?: Date;
  @Column({ name: 'tenant_member_id' })
  tenantMemberId: string;
  @ManyToOne(
    () => TenantMember,
    (member) => member.attendanceExceptions,
  )
  @JoinColumn({ name: 'tenant_member_id' })
  tenantMember: TenantMember;
  @Column({ name: 'approved_by_id', nullable: true })
  approvedById?: string;
  @ManyToOne(
    () => TenantMember,
    (member) => member.approvedAttendanceExceptions,
  )
  @JoinColumn({ name: 'approved_by_id' })
  approvedBy?: TenantMember;
  @Column({ name: 'tenant_id' })
  tenantId: string;
  @ManyToOne(
    () => Tenant,
    (tenant) => tenant.attendanceExceptions,
  )
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;
}
