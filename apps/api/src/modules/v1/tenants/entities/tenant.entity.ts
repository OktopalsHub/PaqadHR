import { Department } from '../../departments/entities/department.entity';
import { Document } from '../../document/entities/document.entity';
import { Leave } from '../../leave/entities/leave.entity';
import { LeaveBalance } from '../../leave-balance/entities/leave-balance.entity';
import { LeaveType } from '../../leave-type/entities/leave-type.entity';
import { Position } from '../../position/entities/position.entity';
import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';
import { User } from '../../users/entities/user.entity';
import {
  Column,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany } from 'typeorm';
import { LeavePolicy } from "../../leave-policy/entities/leave-policy.entity";
import { Team } from "../../teams/entities/team.entity";
import { AttendancePolicy } from "../../attendance/entities/attendance-policy.entity";
import { Attendance } from "../../attendance/entities/attendance.entity";
import { AttendanceException } from "../../attendance/entities/attendance-exception.entity";
import { EmergencyContact } from "../../emergency-contact/entities/emergency-contact.entity";
import { Employment } from "../../employment/entities/employment.entity";
import { Education } from "../../education/entities/education.entity";
import { TenantSubscription } from "../../subscriptions/entities/tenant-subscription.entity";
import { BaseEntity } from "../../../../common/database/entities/base.entity";

@Entity({ name: 'tenants' })
export class Tenant extends BaseEntity {
  @Column()
  name: string;
  @Column({ unique: true })
  slug: string;
  @Column({ name: 'is_active', default: true })
  isActive: boolean;
  @Column({ name: 'invite_code', unique: true })
  inviteCode: string;
  @Column({ name: 'employee_code', nullable: true })
  employeeCode: string;
  @Column({ name: 'industry', type: 'varchar', nullable: true })
  industry: string | null;
  @Column({ name: 'company_size', type: 'varchar', nullable: true })
  companySize: string | null;
  @Column({ name: 'location', type: 'varchar', nullable: true })
  location: string | null;
  @Column({ name: 'logo_key', type: 'varchar', nullable: true })
  logoKey: string | null;
  @Column({ name: 'country_code', type: 'varchar', length: 2, nullable: true })
  countryCode: string | null;
  @Column({ name: 'timezone', type: 'varchar', length: 50, default: 'UTC' })
  timezone: string;
  @Column({
    name: 'preferred_currency',
    type: 'varchar',
    length: 3,
    nullable: true,
  })
  preferredCurrency: string | null;
  @Column({ name: 'pricing_locked', type: 'boolean', default: false })
  pricingLocked: boolean;
  @ManyToOne(() => User, (user) => user.tenants)
  @JoinColumn({ name: 'created_by' })
  createdBy: User;
  @OneToMany(() => TenantMember, (tenantMember) => tenantMember.tenant)
  tenantMembers: TenantMember[];
  @OneToMany(() => LeaveType, (leaveType) => leaveType.tenant)
  leaveTypes: LeaveType[];
  @OneToMany(() => Leave, (leave) => leave.tenant)
  leaves: Leave[];
  @OneToMany(() => LeavePolicy, (leavePolicy) => leavePolicy.tenant)
  leavePolicies: LeavePolicy[];
  @OneToMany(() => LeaveBalance, (leaveBalance) => leaveBalance.tenant)
  leaveBalances: LeaveBalance[];
  @OneToMany(() => Department, (department) => department.tenant)
  departments: Department[];
  @OneToMany(() => Team, (team) => team.tenant)
  teams: Team[];
  @OneToMany(
    () => AttendancePolicy,
    (attendancePolicy) => attendancePolicy.tenant,
  )
  attendancePolicies: AttendancePolicy[];
  @OneToMany(() => Attendance, (attendance) => attendance.tenant)
  attendances: Attendance[];
  @OneToMany(
    () => AttendanceException,
    (attendanceException) => attendanceException.tenant,
  )
  attendanceExceptions: AttendanceException[];
  @OneToMany(
    () => EmergencyContact,
    (emergencyContact) => emergencyContact.tenant,
    { cascade: true },
  )
  emergencyContacts: EmergencyContact[];
  @OneToMany(() => Document, (document) => document.tenant, { cascade: true })
  documents: Document[];
  @OneToMany(() => Employment, (employment) => employment.tenant, {
    cascade: true,
  })
  employments: Employment[];
  @OneToMany(() => Position, (position) => position.tenant, { cascade: true })
  positions: Position[];
  @OneToMany(() => Education, (education) => education.tenant, {
    cascade: true,
  })
  educations: Education[];
  @OneToMany(
    () => TenantSubscription,
    (subscription) => subscription.tenant,
  )
  subscriptions: TenantSubscription[];
  @DeleteDateColumn({
    name: 'deleted_at',
    type: 'timestamp',
    nullable: true,
  })
  deletedAt: Date;
}
