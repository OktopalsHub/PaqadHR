import { InterviewStatus, InterviewType } from 'src/common/enums';
import { Column, DeleteDateColumn, Entity, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../../common/database/entities/base.entity';
import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';
import { Candidate } from './candidate.entity';
import { JobOpening } from './job-opening.entity';

@Entity()
export class Interview extends BaseEntity {
  @Column({ name: 'candidate_id' })
  candidateId: string;
  @Column({ name: 'job_opening_id' })
  jobOpeningId: string;
  @Column({
    type: 'enum',
    enum: InterviewType,
  })
  type: InterviewType;
  @Column({
    type: 'enum',
    enum: InterviewStatus,
    default: InterviewStatus.SCHEDULED,
  })
  status: InterviewStatus;
  @Column()
  date: Date;
  @Column()
  duration: number;
  @Column({ type: 'json' })
  interviewers: {
    userId: string;
    role: string;
  }[];
  @Column({ nullable: true })
  location?: string;
  @Column({ type: 'json', nullable: true })
  feedback: {
    userId: string;
    rating: number;
    strengths: string[];
    weaknesses: string[];
    notes: string;
    submittedAt: Date;
  }[];
  @Column({ type: 'text', nullable: true })
  notes?: string;
  @Column({ name: 'tenant_member_id' })
  tenantMemberId: string;
  @Column({ name: 'tenant_id' })
  tenantId: string;
  @ManyToOne(
    () => TenantMember,
    (tenantMember) => tenantMember.interviews,
  )
  tenantMember: TenantMember;
  @ManyToOne(
    () => Candidate,
    (candidate) => candidate.interviews,
  )
  candidate: Candidate;
  @ManyToOne(
    () => JobOpening,
    (jobOpening) => jobOpening.interviews,
  )
  jobOpening: JobOpening;
  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt: Date;
}
