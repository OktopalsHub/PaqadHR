import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../../common/database/entities/base.entity';
import { PayrollFrequency } from '../../../../common/enums/payroll-frequency.enum';
import { PayrollStatus } from '../../../../common/enums/payroll-status.enum';
import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { PayrollItem } from './payroll-item.entity';

@Entity({ name: 'payroll_runs' })
export class PayrollRun extends BaseEntity {
  @Column({
    type: 'varchar',
    length: 100,
    comment: 'Payroll run title/description',
  })
  title: string;
  @Column({
    type: 'enum',
    enum: PayrollFrequency,
    comment: 'Payroll frequency',
  })
  frequency: PayrollFrequency;
  @Column({
    type: 'date',
    comment: 'Pay period start date',
  })
  periodStart: Date;
  @Column({
    type: 'date',
    comment: 'Pay period end date',
  })
  periodEnd: Date;
  @Column({
    type: 'date',
    comment: 'Scheduled payment date',
  })
  paymentDate: Date;
  @Column({
    type: 'enum',
    enum: PayrollStatus,
    default: PayrollStatus.DRAFT,
    comment: 'Current payroll run status',
  })
  status: PayrollStatus;
  @Column({
    type: 'varchar',
    length: 10,
    comment: 'Base currency for calculations',
  })
  baseCurrency: string;
  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
    comment: 'Total gross amount in base currency',
  })
  totalGrossAmount: number;
  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
    comment: 'Total deductions in base currency',
  })
  totalDeductions: number;
  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
    comment: 'Total net amount in base currency',
  })
  totalNetAmount: number;
  @Column({
    type: 'int',
    default: 0,
    comment: 'Number of employees in this run',
  })
  employeeCount: number;
  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;
  @Column({ name: 'tenant_id' })
  tenantId: string;
  @ManyToOne(() => TenantMember, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'created_by' })
  createdBy: TenantMember;
  @Column({ name: 'created_by' })
  createdById: string;
  @Column({
    type: 'timestamp',
    nullable: true,
    comment: 'When payroll was processed',
  })
  processedAt: Date | null;
  @Column({
    type: 'json',
    nullable: true,
    comment: 'Additional payroll metadata',
  })
  metadata: Record<string, any> | null;
  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    comment: 'Idempotency key for duplicate prevention',
  })
  idempotencyKey: string | null;
  @Column({
    type: 'timestamp',
    nullable: true,
    comment: 'When payroll processing was locked',
  })
  processingLockedAt: Date | null;
  @ManyToOne(() => TenantMember, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'processing_locked_by' })
  processingLockedBy: TenantMember | null;
  @Column({ name: 'processing_locked_by', nullable: true })
  processingLockedById: string | null;
  @OneToMany(
    () => PayrollItem,
    (item) => item.payrollRun,
    {
      cascade: true,
    },
  )
  items: PayrollItem[];
}
