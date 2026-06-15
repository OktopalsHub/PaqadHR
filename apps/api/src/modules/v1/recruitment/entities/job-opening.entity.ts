import { type EmploymentType, JobStatus, type LocationType } from 'src/common/enums';
import { Column, DeleteDateColumn, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../../common/database/entities/base.entity';
import { Department } from '../../departments/entities/department.entity';
import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';
import { Candidate } from './candidate.entity';
import { Interview } from './interview.entity';

@Entity()
export class JobOpening extends BaseEntity {
  @Column()
  title: string;
  @Column({ name: 'department_id', nullable: true })
  departmentId?: string | null;
  @ManyToOne(() => Department, { eager: true, nullable: true })
  @JoinColumn({ name: 'department_id' })
  department?: Department | null;
  @Column()
  position: string;
  @Column({ type: 'varchar', length: 16 })
  employmentType: EmploymentType;
  @Column({ type: 'varchar', length: 50, default: 'Mid-Level' })
  experienceLevel: string;
  @Column({ type: 'json' })
  location: {
    type: LocationType;
    address?: string;
    city?: string;
    country?: string;
  };
  @Column({ type: 'text' })
  description: string;
  @Column({ type: 'json' })
  requirements: string[];
  @Column({ type: 'json' })
  responsibilities: string[];
  @Column({ type: 'json', nullable: true })
  preferredQualifications: string[];
  @Column({ type: 'json', nullable: true })
  requiredSkills: string[];
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  minimumSalary: number;
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  maximumSalary: number;
  @Column({ nullable: true })
  currency: string;
  @Column({ type: 'json', nullable: true })
  benefits: string[];
  @Column({ type: 'varchar', length: 16, default: JobStatus.DRAFT })
  status: JobStatus;
  @Column({ default: false })
  isUrgent: boolean;
  @Column({ name: 'published_at', nullable: true })
  publishedAt: Date;
  @Column({ name: 'closed_at', nullable: true })
  closedAt: Date;
  @Column({ type: 'json', nullable: true })
  customQuestions: unknown[];
  @Column({ name: 'hiring_manager_id', nullable: true })
  hiringManagerId: string;
  @Column({ name: 'number_of_openings', nullable: true })
  numberOfOpenings: number;
  @Column({ name: 'application_deadline', nullable: true })
  applicationDeadline: Date;
  @Column({ name: 'tenant_member_id' })
  tenantMemberId: string;
  @Column({ name: 'tenant_id' })
  tenantId: string;
  @ManyToOne(
    () => TenantMember,
    (tenantMember) => tenantMember.jobOpenings,
  )
  @JoinColumn({ name: 'tenant_member_id' })
  createdBy: TenantMember;
  @OneToMany(
    () => Candidate,
    (candidate) => candidate.jobOpening,
  )
  candidates: Candidate[];
  @OneToMany(
    () => Interview,
    (interview) => interview.jobOpening,
  )
  interviews: Interview[];
  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt: Date;
}
