import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../../common/database/entities/base.entity';
import { PasscodeChangeReason } from '../../../../common/enums/passcode-change-reason.enum';
import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';
import { PaymentMethod } from './payment-method.entity';

@Entity({ name: 'payment_method_passcode_history' })
@Index(['paymentMethodId', 'changedAt'])
@Index(['memberId', 'changedAt'])
export class PaymentMethodPasscodeHistory extends BaseEntity {
  @ManyToOne(() => PaymentMethod, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'payment_method_id' })
  paymentMethod: PaymentMethod;
  @Column({ name: 'payment_method_id' })
  paymentMethodId: string;
  @ManyToOne(() => TenantMember, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'member_id' })
  member: TenantMember;
  @Column({ name: 'member_id' })
  memberId: string;
  @Column({
    type: 'enum',
    enum: PasscodeChangeReason,
    comment: 'Reason for passcode change',
  })
  reason: PasscodeChangeReason;
  @Column({
    type: 'timestamp',
    name: 'changed_at',
    comment: 'When the passcode was changed',
  })
  changedAt: Date;
  @Column({
    type: 'varchar',
    length: 45,
    name: 'ip_address',
    nullable: true,
    comment: 'IP address from which change was made',
  })
  ipAddress: string | null;
  @Column({
    type: 'text',
    name: 'user_agent',
    nullable: true,
    comment: 'User agent from which change was made',
  })
  userAgent: string | null;
  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    name: 'changed_by_admin_id',
    comment: 'Admin ID if changed by admin',
  })
  changedByAdminId: string | null;
  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
    comment: 'Additional notes about the change',
  })
  notes: string | null;
  @Column({
    type: 'boolean',
    default: false,
    name: 'was_forced',
    comment: 'Whether this was a forced change (security reasons)',
  })
  wasForced: boolean;
  @Column({
    type: 'json',
    nullable: true,
    comment: 'Additional metadata about the change',
  })
  metadata: Record<string, unknown> | null;
}
