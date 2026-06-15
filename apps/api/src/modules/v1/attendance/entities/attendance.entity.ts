import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../../common/database/entities/base.entity';
import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';

@Entity('attendances')
export class Attendance extends BaseEntity {
  @Column({ name: 'tenant_id' })
  tenantId: string;
  @ManyToOne(
    () => Tenant,
    (tenant) => tenant.attendances,
  )
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;
  @Column({ name: 'tenant_member_id' })
  tenantMemberId: string;
  @ManyToOne(
    () => TenantMember,
    (member) => member.attendances,
  )
  @JoinColumn({ name: 'tenant_member_id' })
  tenantMember: TenantMember;
  @Column({ type: 'date' })
  date: Date;
  @Column({ type: 'timestamp', nullable: true })
  clockIn: Date;
  @Column({ type: 'timestamp', nullable: true })
  clockOut: Date;
  @Column({ name: 'work_hours', type: 'varchar', length: 10, nullable: true })
  workHours: string;
  @Column({ type: 'varchar', length: 16, default: 'ABSENT' })
  status: string;
  @Column({ type: 'varchar', length: 16, default: 'CLOSED' })
  sessionStatus: string;
  @Column({ type: 'int', default: 1 })
  sessionNumber: number;
  @Column({ type: 'text', nullable: true })
  notes: string;
  @Column({ type: 'varchar', length: 255, nullable: true })
  location: string;
  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress: string;
  @Column({ type: 'varchar', length: 255, nullable: true })
  userAgent: string;
  @Column({ type: 'varchar', length: 50, nullable: true })
  deviceType: string;
  @Column({ type: 'varchar', length: 50, nullable: true })
  entryMethod: string;
  @Column({ type: 'boolean', default: false })
  isManualEntry: boolean;
  @Column({ name: 'approved_by_id', nullable: true })
  approvedById: string;
  @ManyToOne(
    () => TenantMember,
    (member) => member.approvedAttendances,
  )
  @JoinColumn({ name: 'approved_by_id' })
  approvedBy: TenantMember;
  @Column({ type: 'timestamp', nullable: true })
  approvedAt: Date;
}
