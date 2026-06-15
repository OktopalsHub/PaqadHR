import { EmploymentStatus, PaySchedule, PayType } from 'src/common/enums';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../../common/database/entities/base.entity';
import type { Position } from '../../position/entities/position.entity';
import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';

@Entity()
export class Employment extends BaseEntity {
  @Column({ type: 'date', name: 'start_date' })
  startDate: Date;
  @Column({ type: 'date', name: 'end_date', nullable: true })
  endDate?: Date;
  @Column({
    type: 'enum',
    enum: EmploymentStatus,
    default: EmploymentStatus.ACTIVE,
  })
  status: EmploymentStatus;
  @Column({ name: 'tenant_member_id' })
  tenantMemberId: string;
  @Column({ name: 'position_id' })
  positionId: string;
  @Column({ name: 'tenant_id' })
  tenantId: string;
  @Column({ name: 'reports_to_id', nullable: true })
  reportsToId?: string;
  @Column({ type: 'enum', enum: PayType, default: PayType.SALARY })
  payType: PayType;
  @Column({ type: 'enum', enum: PaySchedule, default: PaySchedule.MONTHLY })
  paySchedule: PaySchedule;
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    name: 'pay_rate',
  })
  payRate: number;
  @Column({ type: 'text', nullable: true })
  comments?: string;
  @Column({ name: 'created_by', nullable: true })
  createdBy?: string;
  @ManyToOne(
    () => TenantMember,
    (member) => member.employments,
  )
  @JoinColumn({ name: 'tenant_member_id' })
  tenantMember: TenantMember;
  @ManyToOne('Position', 'members', { eager: true })
  @JoinColumn({ name: 'position_id' })
  position: Position;
  @ManyToOne(
    () => TenantMember,
    (member) => member.subordinates,
    {
      nullable: true,
    },
  )
  @JoinColumn({ name: 'reports_to_id' })
  reportsTo?: TenantMember;
  @ManyToOne(() => TenantMember, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  creator?: TenantMember;
  @ManyToOne(
    () => Tenant,
    (tenant) => tenant.employments,
  )
  tenant: Tenant;
}
