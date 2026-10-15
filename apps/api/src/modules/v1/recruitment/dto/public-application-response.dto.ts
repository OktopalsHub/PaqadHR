import { ApiProperty } from '@nestjs/swagger';
import { CandidateStatus } from 'src/common/enums';
import type { Candidate } from '../entities/candidate.entity';

/** Minimal applicant-facing fields — no contact info, tenant IDs, or file URLs. */
export class PublicApplicationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  jobOpeningId: string;

  @ApiProperty({ enum: CandidateStatus })
  status: CandidateStatus;

  @ApiProperty()
  currentStage: { name: string };

  @ApiProperty()
  appliedAt: string;

  @ApiProperty({ required: false })
  withdrawnAt?: string;
}

export class PublicApplicationMapper {
  static toResponse(candidate: Candidate): PublicApplicationResponseDto {
    return {
      id: candidate.id,
      jobOpeningId: candidate.jobOpeningId,
      status: candidate.status,
      currentStage: { name: candidate.currentStage.name },
      appliedAt: candidate.appliedAt.toISOString(),
      withdrawnAt: candidate.withdrawnAt?.toISOString(),
    };
  }
}
