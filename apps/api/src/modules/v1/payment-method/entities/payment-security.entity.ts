import { Column, Entity, JoinColumn, OneToOne } from 'typeorm';
import { TenantMember } from "../../tenant-members/entities/tenant-member.entity";
import { BaseEntity } from "../../../../common/database/entities/base.entity";

@Entity({ name: 'payment_security' })
export class PaymentSecurity extends BaseEntity {
  @OneToOne(() => TenantMember, (member) => member.paymentSecurity, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'member_id' })
  member: TenantMember;
  @Column({
    name: 'payment_passcode',
    type: 'varchar',
    select: false,
    nullable: false,
    comment: 'hashed payment security passcode',
  })
  paymentPasscode: string;
  @Column({
    name: 'passcode_attempts',
    type: 'int',
    default: 0,
    comment: 'Failed passcode attempt counter',
  })
  passcodeAttempts: number;
  @Column({
    name: 'passcode_locked_until',
    type: 'timestamp',
    nullable: true,
    comment: 'Account lock expiration after failed attempts',
  })
  passcodeLockedUntil: Date | null;
}
