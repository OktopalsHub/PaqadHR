import {
  CandidateSource,
  CandidateStatus,
  InterviewType,
} from 'src/common/enums';
import {
  Column,
  DeleteDateColumn,
  Entity,
  ManyToOne,
  OneToMany } from 'typeorm';
import { Interview } from './interview.entity';
import { JobOpening } from './job-opening.entity';
import { BaseEntity } from "../../../../common/database/entities/base.entity";

@Entity()
export class Candidate extends BaseEntity {
  @Column({ name: 'job_opening_id' })
  jobOpeningId: string;
  @Column({ name: 'first_name' })
  firstName: string;
  @Column({ name: 'last_name' })
  lastName: string;
  @Column()
  email: string;
  @Column()
  phone: string;
  @Column({ type: 'json' })
  resume: {
    url?: string;
    filename: string;
    uploadedAt: Date;
  };
  @Column({ type: 'json', nullable: true })
  coverLetter?: {
    url?: string;
    filename: string;
    uploadedAt: Date;
  };
  @Column({ type: 'text', nullable: true })
  coverLetterText?: string;
  @Column({
    type: 'enum',
    enum: CandidateStatus,
    default: CandidateStatus.APPLIED,
  })
  status: CandidateStatus;
  @Column({ type: 'json' })
  currentStage: {
    name: string;
    startedAt: Date;
    completedAt?: Date;
  };
  @Column({ type: 'json', nullable: true })
  interviewSchedule?: {
    date: Date;
    type: InterviewType;
    interviewers: string[];
    location?: string;
    notes?: string;
  }[];
  @Column({ name: 'tenant_id' })
  tenantId: string;
  @Column({
    name: 'source',
    type: 'enum',
    enum: CandidateSource,
    default: CandidateSource.PUBLIC_WEBSITE,
  })
  source: CandidateSource;
  @Column({
    name: 'applied_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  appliedAt: Date;
  @Column({ name: 'withdrawn_at', type: 'timestamp', nullable: true })
  withdrawnAt: Date | null;
  @Column({ type: 'json', nullable: true })
  location?: {
    city?: string;
    country?: string;
    remote?: boolean;
  };
  @Column({ type: 'text', nullable: true })
  portfolioUrl?: string;
  @Column({ type: 'text', nullable: true })
  linkedinUrl?: string;
  @Column({ type: 'text', nullable: true })
  githubUrl?: string;
  @Column({ type: 'text', nullable: true })
  skills?: string;
  @Column({ type: 'json', nullable: true })
  experience?: {
    years: number;
    currentRole?: string;
    currentCompany?: string;
    expectedSalary?: string;
    availabilityDate?: Date;
  };
  @ManyToOne(() => JobOpening, (jobOpening) => jobOpening.candidates)
  jobOpening: JobOpening;
  @OneToMany(() => Interview, (interview) => interview.candidate)
  interviews: Interview[];
  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt: Date;
}
