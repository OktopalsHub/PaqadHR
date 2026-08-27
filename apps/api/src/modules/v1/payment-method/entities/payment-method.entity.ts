import { PaymentMethodType } from 'src/common/enums';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../../common/database/entities/base.entity';
import { PaymentMethodStatus } from '../../../../common/enums/payment-method-status.enum';
import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';

@Entity({ name: 'payment_methods' })
@Index(['tenantId', 'memberId', 'isPrimary'])
@Index(['tenantId', 'currency', 'isPrimary'])
export class PaymentMethod extends BaseEntity {
  @ManyToOne(
    () => Tenant,
    (tenant) => tenant.tenantMembers,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;
  @Column({ name: 'tenant_id' })
  tenantId: string;
  @ManyToOne(
    () => TenantMember,
    (member) => member.id,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'member_id' })
  member: TenantMember;
  @Column({ name: 'member_id' })
  memberId: string;
  @Column({
    type: 'enum',
    enum: PaymentMethodType,
    default: PaymentMethodType.BANK,
    comment: 'Payment method type — BANK or CRYPTO',
  })
  type: PaymentMethodType;
  @Column({ name: 'currency', type: 'varchar', length: 10, nullable: true })
  currency: string | null;
  @Column({ name: 'bank_name', type: 'varchar', length: 120, nullable: true })
  bankName: string | null;
  @Column({ name: 'bank_code', type: 'varchar', length: 20, nullable: true })
  bankCode: string | null;
  @Column({
    name: 'account_name',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  accountName: string | null;
  @Column({
    name: 'account_number',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  accountNumber: string | null;
  @Column({ name: 'country', type: 'varchar', length: 2, nullable: true })
  country: string | null;
  @Column({ name: 'is_primary', default: false })
  isPrimary: boolean;
  @Column({
    type: 'enum',
    enum: PaymentMethodStatus,
    default: PaymentMethodStatus.PENDING_VERIFICATION,
    comment: 'Payment method verification status',
  })
  status: PaymentMethodStatus;
  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    name: 'display_name',
    comment: 'User-friendly name for this payment method',
  })
  displayName: string | null;
  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    name: 'passcode_hash',
    comment: 'Hashed passcode for payment method changes',
  })
  passcodeHash: string | null;
  @Column({
    type: 'timestamp',
    nullable: true,
    name: 'passcode_set_at',
    comment: 'When passcode was last set/changed',
  })
  passcodeSetAt: Date | null;
  @Column({
    type: 'timestamp',
    nullable: true,
    name: 'last_passcode_change',
    comment: 'When passcode was last changed',
  })
  lastPasscodeChange: Date | null;
  @Column({
    type: 'int',
    default: 0,
    name: 'failed_passcode_attempts',
    comment: 'Number of failed passcode attempts',
  })
  failedPasscodeAttempts: number;
  @Column({
    type: 'timestamp',
    nullable: true,
    name: 'locked_until',
    comment: 'When account is locked until due to failed attempts',
  })
  lockedUntil: Date | null;
  @Column({
    type: 'timestamp',
    nullable: true,
    name: 'verified_at',
    comment: 'When payment method was verified',
  })
  verifiedAt: Date | null;
  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
    name: 'verification_notes',
    comment: 'Notes from verification process',
  })
  verificationNotes: string | null;
  @Column({
    type: 'timestamp',
    nullable: true,
    name: 'last_used_at',
    comment: 'When this payment method was last used',
  })
  lastUsedAt: Date | null;
  @Column({
    type: 'json',
    nullable: true,
    comment: 'Additional payment method metadata',
  })
  metadata: Record<string, unknown> | null;

  get isVerified(): boolean {
    return this.status === PaymentMethodStatus.VERIFIED;
  }
  get canReceivePayments(): boolean {
    return this.isVerified && !this.isLocked;
  }
  get isLocked(): boolean {
    return this.lockedUntil ? new Date() < this.lockedUntil : false;
  }
  get displayInfo(): string {
    if (this.displayName) {
      return this.displayName;
    }
    if (this.type === PaymentMethodType.BANK) {
      return `${this.bankName} - ${this.accountNumber?.slice(-4)}`;
    }
    if (this.type === PaymentMethodType.CRYPTO) {
      return `Crypto ${this.currency ?? ''} - ${this.accountNumber?.slice(-6)}`;
    }
    return 'Bank Account';
  }
  get requiresPasscode(): boolean {
    return this.passcodeHash !== null;
  }
}
