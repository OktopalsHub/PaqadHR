import { AttendanceException } from '../../attendance/entities/attendance-exception.entity';
import { Attendance } from '../../attendance/entities/attendance.entity';
import { Document } from '../../document/entities/document.entity';
import { EmergencyContact } from '../../emergency-contact/entities/emergency-contact.entity';
import { LeaveBalance } from '../../leave-balance/entities/leave-balance.entity';
import { PositionMember } from '../../position/entities/position-member.entity';
import { User } from '../../users/entities/user.entity';
import { Gender, TenantMemberRole } from 'src/common/enums';
import {
  Column,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  Unique } from 'typeorm';
import { Tenant } from "../../tenants/entities/tenant.entity";
import { Address } from "../../address/entities/address.entity";
import { LeaveType } from "../../leave-type/entities/leave-type.entity";
import { Leave } from "../../leave/entities/leave.entity";
import { DepartmentMember } from "../../departments/entities/department-member.entity";
import { TeamMember } from "../../teams/entities/team-member.entity";
import { Education } from "../../education/entities/education.entity";
import { Employment } from "../../employment/entities/employment.entity";
import { PaymentMethod } from "../../payment-method/entities/payment-method.entity";
import { PaymentSecurity } from "../../payment-method/entities/payment-security.entity";
import { JobOpening } from "../../recruitment/entities/job-opening.entity";
import { Interview } from "../../recruitment/entities/interview.entity";
import { BaseEntity } from "../../../../common/database/entities/base.entity";

@Entity({ name: 'tenant_members' })
@Unique(['tenantId', 'employeeNumber'])
export class TenantMember extends BaseEntity {
  @Column({ name: 'first_name', type: 'varchar', nullable: true })
  firstName: string | null;
  @Column({ name: 'last_name', type: 'varchar', nullable: true })
  lastName: string | null;
  @Column({ name: 'middle_name', type: 'varchar', nullable: true })
  middleName: string | null;
  @Column({ name: 'preferred_name', type: 'varchar', nullable: true })
  preferredName: string | null;
  @Column({
    type: 'varchar',
    nullable: true,
    })
  phone: string | null;
  @Column({
    name: 'date_of_birth',
    type: 'date',
    nullable: true,
    })
  dateOfBirth: Date | null;
  @Column({ type: 'enum', enum: Gender, nullable: true })
  gender: Gender | null;
  @Column({ default: TenantMemberRole.MEMBER })
  role: string;
  @Column({ name: 'is_active', default: true })
  isActive: boolean;
  @Column({ name: 'avatar_key', type: 'varchar', nullable: true })
  avatarKey: string | null;
  @Column({
    name: 'join_date',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  joinDate: Date;
  @Column({ name: 'leave_date', type: 'timestamp', nullable: true })
  leaveDate: Date;
  @Column({ name: 'user_id' })
  userId: string;
  @ManyToOne(() => User, (user) => user.tenantMembers)
  @JoinColumn({ name: 'user_id' })
  user: User;
  @Column({ name: 'tenant_id' })
  tenantId: string;
  @Column({ name: 'employee_number', nullable: true })
  employeeNumber: string;
  @ManyToOne(() => Tenant, (tenant) => tenant.tenantMembers)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;
  @OneToMany(() => PositionMember, (memberPosition) => memberPosition.member)
  positionHistory: PositionMember[];
  @OneToOne(() => Address, (address) => address.tenantMember)
  address: Address;
  @OneToMany(() => LeaveType, (leaveType) => leaveType.tenantMember)
  leaveTypes: LeaveType[];
  @OneToMany(() => LeaveBalance, (leaveBalance) => leaveBalance.tenantMember)
  leaveBalances: LeaveBalance[];
  @OneToMany(() => Leave, (leave) => leave.requester)
  requestedLeaves: Leave[];
  @OneToMany(() => Leave, (leave) => leave.approver)
  approvedLeaves: Leave[];
  @OneToMany(() => DepartmentMember, (member) => member.member)
  departmentMemberships: DepartmentMember[];
  @OneToMany(() => TeamMember, (member) => member.member)
  teamMemberships: TeamMember[];
  @OneToMany(() => Attendance, (attendance) => attendance.tenantMember)
  attendances: Attendance[];
  @OneToMany(() => Attendance, (attendance) => attendance.approvedBy)
  approvedAttendances: Attendance[];
  @OneToMany(() => AttendanceException, (exception) => exception.tenantMember)
  attendanceExceptions: AttendanceException[];
  @OneToMany(() => AttendanceException, (exception) => exception.approvedBy)
  approvedAttendanceExceptions: AttendanceException[];
  @OneToMany(() => Education, (education) => education.tenantMember)
  educations: Education[];
  @OneToMany(() => Employment, (employment) => employment.tenantMember)
  employments: Employment[];
  @OneToMany(() => Employment, (employment) => employment.reportsTo)
  subordinates: Employment[];
  @OneToMany(
    () => EmergencyContact,
    (emergencyContact) => emergencyContact.tenantMember,
  )
  emergencyContacts: EmergencyContact[];
  @OneToOne(() => PaymentMethod, (paymentMethod) => paymentMethod.member)
  paymentMethod: PaymentMethod;
  @OneToOne(() => PaymentSecurity, (paymentSecurity) => paymentSecurity.member)
  paymentSecurity: PaymentSecurity;
  @OneToMany(() => JobOpening, (jobOpening) => jobOpening.createdBy)
  jobOpenings: JobOpening[];
  @OneToMany(() => Interview, (interview) => interview.tenantMember)
  interviews: Interview[];
  @OneToMany(() => Document, (document) => document.tenantMember)
  documents: Document[];
  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt: Date;
  get currentPosition(): PositionMember | null {
    if (!this.positionHistory || this.positionHistory.length === 0) return null;
    const active = this.positionHistory.find(
      (p: PositionMember) => p.isCurrent,
    );
    if (active) return active;
    return this.positionHistory
      .slice()
      .sort(
        (a, b) =>
          (b.assignedAt?.getTime() || 0) - (a.assignedAt?.getTime() || 0),
      )[0];
  }
  get displayName(): string {
    const fullName = `${this.firstName || ''} ${this.lastName || ''}`.trim();
    return fullName || this.preferredName || 'Unknown User';
  }
}
