import { ApiProperty } from '@nestjs/swagger';
export class JobMatchDto {
  @ApiProperty({ description: 'Job opening ID' })
  jobId: string;
  @ApiProperty({ description: 'Job title' })
  jobTitle: string;
  @ApiProperty({ description: 'Match score (0-100)' })
  matchScore: number;
  @ApiProperty({ description: 'Reasons for the match', type: [String] })
  reasons: string[];
}
