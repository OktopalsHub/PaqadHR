import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../../common/database/entities/base.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';

@Entity('attendance_policies')
export class AttendancePolicy extends BaseEntity {
  @Column()
  name: string;
  @Column()
  description: string;
  @Column({ type: 'time', name: 'work_start_time' })
  workStartTime: string;
  @Column({ type: 'time', name: 'work_end_time' })
  workEndTime: string;
  @Column({ name: 'late_threshold' })
  lateThreshold: number;
  @Column({ name: 'half_day_threshold' })
  halfDayThreshold: number;
  @Column({ name: 'grace_period' })
  gracePeriod: number;
  @Column({ name: 'max_sessions_per_day', default: 3 })
  maxSessionsPerDay: number;
  @Column({ name: 'is_active', default: true })
  isActive: boolean;
  @Column({ name: 'tenant_id' })
  tenantId: string;
  @ManyToOne(
    () => Tenant,
    (tenant) => tenant.attendancePolicies,
  )
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;
}
