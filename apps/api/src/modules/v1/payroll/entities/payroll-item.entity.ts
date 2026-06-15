import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../../common/database/entities/base.entity';
import { PayrollItemStatus } from '../../../../common/enums/payroll-item-status.enum';
import { PaymentMethod } from '../../payment-method/entities/payment-method.entity';
import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';
import { PayrollRun } from './payroll-run.entity';

@Entity({ name: 'payroll_items' })
export class PayrollItem extends BaseEntity {
  @ManyToOne(
    () => PayrollRun,
    (run) => run.items,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'payroll_run_id' })
  payrollRun: PayrollRun;
  @Column({ name: 'payroll_run_id' })
  payrollRunId: string;
  @ManyToOne(() => TenantMember, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee: TenantMember;
  @Column({ name: 'employee_id' })
  memberId: string;
  @Column({
    type: 'enum',
    enum: PayrollItemStatus,
    default: PayrollItemStatus.PENDING,
    comment: 'Payment status for this employee',
  })
  status: PayrollItemStatus;
  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    comment: 'Base salary amount',
  })
  baseSalary: number;
  @Column({
    type: 'varchar',
    length: 10,
    comment: 'Base salary currency',
  })
  baseSalaryCurrency: string;
  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    comment: 'Gross amount in base currency',
  })
  grossAmount: number;
  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
    comment: 'Manual adjustments (bonuses, overtime, etc.)',
  })
  adjustments: number;
  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
    comment: 'Manual deductions',
  })
  deductions: number;
  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    comment: 'Net amount in base currency',
  })
  netAmount: number;
  @Column({
    type: 'varchar',
    length: 10,
    comment: 'Currency for payment',
  })
  paymentCurrency: string;
  @Column({
    type: 'decimal',
    precision: 15,
    scale: 8,
    comment: 'Net amount in payment currency',
  })
  paymentAmount: number;
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 6,
    comment: 'Exchange rate used for conversion',
  })
  exchangeRate: number;
  @ManyToOne(() => PaymentMethod, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'payment_method_id' })
  paymentMethod: PaymentMethod | null;
  @Column({ name: 'payment_method_id', nullable: true })
  paymentMethodId: string | null;
  @Column({
    type: 'text',
    nullable: true,
    comment: 'Description of payment',
  })
  description: string | null;
  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    name: 'transaction_id',
    comment: 'Payment transaction ID',
  })
  transactionId: string | null;
  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
    comment: 'Payment provider used',
  })
  paymentProvider: string | null;
  @Column({
    type: 'timestamp',
    nullable: true,
    comment: 'When payment was processed',
  })
  paidAt: Date | null;
  @Column({
    type: 'text',
    nullable: true,
    comment: 'Payment failure reason',
  })
  failureReason: string | null;
  @Column({
    type: 'json',
    nullable: true,
    comment: 'Additional item metadata',
  })
  metadata: Record<string, any> | null;
}
