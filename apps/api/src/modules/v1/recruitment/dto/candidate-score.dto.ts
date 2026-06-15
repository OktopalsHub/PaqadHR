import { ApiProperty } from '@nestjs/swagger';
export class ScoreBreakdownDto {
  @ApiProperty({ description: 'Skills match score (0-100)' })
  skillsMatch: number;
  @ApiProperty({ description: 'Experience match score (0-100)' })
  experienceMatch: number;
  @ApiProperty({ description: 'Education match score (0-100)' })
  educationMatch: number;
  @ApiProperty({ description: 'Keyword match score (0-100)' })
  keywordMatch: number;
}
export class CandidateScoreDto {
  @ApiProperty({ description: 'Candidate ID' })
  candidateId: string;
  @ApiProperty({ description: 'Job opening ID' })
  jobId: string;
  @ApiProperty({ description: 'Overall match score (0-100)' })
  overallScore: number;
  @ApiProperty({ description: 'Detailed score breakdown', type: ScoreBreakdownDto })
  breakdown: ScoreBreakdownDto;
  @ApiProperty({ description: 'Candidate strengths', type: [String] })
  strengths: string[];
  @ApiProperty({ description: 'Candidate gaps or areas for improvement', type: [String] })
  gaps: string[];
  @ApiProperty({
    description: 'Recommendation for this candidate',
    enum: ['strong_fit', 'good_fit', 'potential_fit', 'not_recommended'],
  })
  recommendation: 'strong_fit' | 'good_fit' | 'potential_fit' | 'not_recommended';
}
