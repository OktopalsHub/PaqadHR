import { InvitationStatus } from 'src/common/enums';
import {
  Column,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne } from 'typeorm';
import { Department } from "../../departments/entities/department.entity";
import { Position } from "../../position/entities/position.entity";
import { TenantMember } from "../../tenant-members/entities/tenant-member.entity";
import { BaseEntity } from "../../../../common/database/entities/base.entity";

@Entity({ name: 'invitations' })
export class Invitation extends BaseEntity {
  @Column()
  email: string;
  @Column({ name: 'tenant_id' })
  tenantId: string;
  @Column({ name: 'first_name' })
  firstName: string;
  @Column({ name: 'last_name' })
  lastName: string;
  @Column({ name: 'middle_name', nullable: true })
  middleName?: string;
  @Column({ name: 'job_title', nullable: true })
  jobTitle?: string;
  @Column({ name: 'department_id', nullable: true })
  departmentId?: string;
  @ManyToOne(() => Department, { nullable: true })
  @JoinColumn({ name: 'department_id' })
  department?: Department;
  @Column({ name: 'employment_type', nullable: true })
  employmentType?: string;
  @Column({ name: 'employee_number', nullable: true })
  employeeNumber?: string;
  @Column({ name: 'position_id', nullable: true })
  positionId?: string;
  @ManyToOne(() => Position, { nullable: true })
  @JoinColumn({ name: 'position_id' })
  position?: Position;
  @Column()
  role: string;
  @Column({
    type: 'enum',
    enum: InvitationStatus,
    default: InvitationStatus.PENDING,
  })
  status: InvitationStatus;
  @Column({ name: 'invited_by' })
  invitedBy: string;
  @ManyToOne(() => TenantMember, { nullable: false })
  @JoinColumn({ name: 'invited_by' })
  invitedByMember: TenantMember;
  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt: Date;
  @Column({ name: 'token', unique: true })
  token: string;
  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date;
}
