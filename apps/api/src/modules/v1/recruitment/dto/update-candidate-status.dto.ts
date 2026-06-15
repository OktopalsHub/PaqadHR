import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { CandidateStatus } from 'src/common/enums';
export class UpdateCandidateStatusDto {
  @ApiProperty({
    enum: CandidateStatus,
    example: CandidateStatus.INTERVIEW,
    description: 'Current status of the candidate',
  })
  @IsEnum(CandidateStatus)
  status: CandidateStatus;
  @ApiPropertyOptional({ example: 'Candidate passed initial screening' })
  @IsOptional()
  @IsString()
  notes?: string;
}
