import { ApiProperty } from '@nestjs/swagger';
export class RecruitmentInsightsDto {
  @ApiProperty({ description: 'Total number of active job openings' })
  totalActiveJobs: number;
  @ApiProperty({ description: 'Number of jobs that have candidates' })
  jobsWithCandidates: number;
  @ApiProperty({ description: 'Average candidates per job opening' })
  averageCandidatesPerJob: number;
  @ApiProperty({ description: 'Top skills in demand', type: [String] })
  topSkillsInDemand: string[];
  @ApiProperty({ description: 'AI-generated recommendations', type: [String] })
  recommendations: string[];
}