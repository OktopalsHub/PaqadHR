import { Interview } from '../entities/interview.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { ApiProperty } from '@nestjs/swagger';
import { FileUploadLocation } from 'src/common/enums/file-upload-location.enum';
import { FileUrlMapper } from 'src/common/mappers/file-url.mapper';
import { FileUrlService } from 'src/common/services/file-url.service';
import {
  CandidateSource,
  CandidateStatus,
  InterviewType,
} from 'src/common/enums';
import { Candidate } from "../entities/candidate.entity";

export class CandidateResumeDto {
  @ApiProperty({ description: 'Resume filename' })
  filename: string;
  @ApiProperty({
    description: 'Resume URL (constructed from filename)',
    required: false,
  })
  url?: string;
  @ApiProperty({ description: 'Upload timestamp' })
  uploadedAt: Date;
}
export class CandidateCoverLetterDto {
  @ApiProperty({ description: 'Cover letter filename' })
  filename: string;
  @ApiProperty({
    description: 'Cover letter URL (constructed from filename)',
    required: false,
  })
  url?: string;
  @ApiProperty({ description: 'Upload timestamp' })
  uploadedAt: Date;
}
export class CandidateResponseDto {
  @ApiProperty({ description: 'Candidate ID' })
  id: string;
  @ApiProperty({ description: 'Job opening ID' })
  jobOpeningId: string;
  @ApiProperty({ description: 'First name' })
  firstName: string;
  @ApiProperty({ description: 'Last name' })
  lastName: string;
  @ApiProperty({ description: 'Email address' })
  email: string;
  @ApiProperty({ description: 'Phone number' })
  phone: string;
  @ApiProperty({ description: 'Resume information', type: CandidateResumeDto })
  resume: CandidateResumeDto;
  @ApiProperty({
    description: 'Cover letter information',
    type: CandidateCoverLetterDto,
    required: false,
  })
  coverLetter?: CandidateCoverLetterDto;
  @ApiProperty({
    description: 'Candidate status',
    enum: CandidateStatus,
    example: CandidateStatus.APPLIED,
  })
  status: CandidateStatus;
  @ApiProperty({ description: 'Current stage information' })
  currentStage: {
    name: string;
    startedAt: Date;
    completedAt?: Date;
  };
  @ApiProperty({ description: 'Interview schedule', required: false })
  interviewSchedule?: {
    date: Date;
    type: InterviewType;
    interviewers: string[];
    location?: string;
    notes?: string;
  }[];
  @ApiProperty({ description: 'Tenant ID' })
  tenantId: string;
  @ApiProperty({
    description: 'Application source',
    enum: CandidateSource,
    example: CandidateSource.PUBLIC_WEBSITE,
  })
  source: CandidateSource;
  @ApiProperty({ description: 'Application date' })
  appliedAt: Date;
  @ApiProperty({ description: 'Withdrawal date', required: false })
  withdrawnAt?: Date;
  @ApiProperty({ description: 'Location information', required: false })
  location?: {
    city?: string;
    country?: string;
    remote?: boolean;
  };
  @ApiProperty({ description: 'Portfolio URL', required: false })
  portfolioUrl?: string;
  @ApiProperty({ description: 'LinkedIn URL', required: false })
  linkedinUrl?: string;
  @ApiProperty({ description: 'GitHub URL', required: false })
  githubUrl?: string;
  @ApiProperty({ description: 'Skills', required: false })
  skills?: string;
  @ApiProperty({ description: 'Experience information', required: false })
  experience?: {
    years: number;
    currentRole?: string;
    currentCompany?: string;
    expectedSalary?: string;
    availabilityDate?: Date;
  };
  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: string;
  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: string;
}
export class CandidateMapper {
  static toResponse(
    candidate: Candidate,
    fileUrlService?: FileUrlService,
  ): CandidateResponseDto {
    const response: CandidateResponseDto = {
      id: candidate.id,
      jobOpeningId: candidate.jobOpeningId,
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      email: candidate.email,
      phone: candidate.phone,
      resume: {
        filename: candidate.resume.filename,
        uploadedAt: candidate.resume.uploadedAt,
      },
      status: candidate.status,
      currentStage: candidate.currentStage,
      interviewSchedule: candidate.interviewSchedule,
      tenantId: candidate.tenantId,
      source: candidate.source,
      appliedAt: candidate.appliedAt,
      withdrawnAt: candidate.withdrawnAt || undefined,
      location: candidate.location,
      portfolioUrl: candidate.portfolioUrl,
      linkedinUrl: candidate.linkedinUrl,
      githubUrl: candidate.githubUrl,
      skills: candidate.skills,
      experience: candidate.experience,
      createdAt: candidate.createdAt.toISOString(),
      updatedAt: candidate.updatedAt.toISOString(),
    };
    if (fileUrlService && candidate.resume.filename) {
      response.resume.url =
        FileUrlMapper.mapFileByLocation(
          candidate.resume.filename,
          FileUploadLocation.RESUMES,
          {
            tenantId: candidate.tenantId,
            fileUrlService,
          },
        ) || undefined;
    }
    if (candidate.coverLetter) {
      response.coverLetter = {
        filename: candidate.coverLetter.filename,
        uploadedAt: candidate.coverLetter.uploadedAt,
      };
      if (fileUrlService && candidate.coverLetter.filename) {
        response.coverLetter.url =
          FileUrlMapper.mapFileByLocation(
            candidate.coverLetter.filename,
            FileUploadLocation.ATTACHMENTS,
            {
              tenantId: candidate.tenantId,
              fileUrlService,
            },
          ) || undefined;
      }
    }
    return response;
  }
  static toResponseList(
    candidates: Candidate[],
    fileUrlService?: FileUrlService,
  ): CandidateResponseDto[] {
    return candidates.map((candidate) =>
      this.toResponse(candidate, fileUrlService),
    );
  }
}
