import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  Allow,
  IsDateString,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

class CurrentStageDto {
  @ApiPropertyOptional({
    description: 'Stage name',
    example: 'Technical Interview',
  })
  @ApiProperty({
    description: 'name',
    example: 'Example Name',
  })
  @IsString()
  name: string;
  @ApiPropertyOptional({
    description: 'Stage start date',
    example: '2024-12-15T10:00:00.000Z',
  })
  @ApiProperty({
    description: 'started at',
  })
  @IsDateString()
  startedAt: string;
}
export class UpdateCandidateDto {
  @ApiPropertyOptional({
    description: 'Candidate status',
    enum: ['APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED'],
    example: 'INTERVIEW',
  })
  @IsEnum(['APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED'])
  @ApiProperty({
    description: 'status',
    required: false,
  })
  @IsOptional()
  status?: 'APPLIED' | 'SCREENING' | 'INTERVIEW' | 'OFFER' | 'HIRED' | 'REJECTED';
  @ApiPropertyOptional({
    description: 'Current stage information',
    type: CurrentStageDto,
  })
  @IsObject()
  @ValidateNested()
  @Type(() => CurrentStageDto)
  @ApiProperty({
    description: 'current stage',
    required: false,
  })
  @IsOptional()
  currentStage?: CurrentStageDto;
  @ApiPropertyOptional({
    description: 'Phone number',
    example: '+2348012345678',
  })
  @IsOptional()
  @IsString()
  phone?: string;
  @ApiPropertyOptional({
    description: 'Location preferences',
    type: Object,
  })
  @IsOptional()
  @IsObject()
  location?: unknown;
  @ApiPropertyOptional({
    description: 'Portfolio website URL',
    example: 'https://portfolio.com/johndoe',
  })
  @IsOptional()
  @IsString()
  portfolioUrl?: string;
  @ApiPropertyOptional({
    description: 'LinkedIn profile URL',
    example: 'https://linkedin.com/in/johndoe',
  })
  @IsOptional()
  @IsString()
  linkedinUrl?: string;
  @ApiPropertyOptional({
    description: 'GitHub profile URL',
    example: 'https://github.com/johndoe',
  })
  @IsOptional()
  @IsString()
  githubUrl?: string;
  @ApiPropertyOptional({
    description: 'Technical skills and technologies',
    example: 'NestJS, TypeScript, PostgreSQL, React',
  })
  @IsOptional()
  @IsString()
  skills?: string;
  @ApiPropertyOptional({
    description: 'Work experience details',
    type: Object,
  })
  @IsOptional()
  @IsObject()
  experience?: unknown;
  @ApiPropertyOptional({
    description: 'Resume filename (obtained from file upload)',
    example: 'john_doe_resume.pdf',
  })
  @IsOptional()
  @Allow()
  @Transform(({ value }) => {
    if (typeof value === 'object' && value && typeof value.filename === 'string') {
      return value.filename;
    }
    if (typeof value === 'string') {
      return value;
    }
    return value;
  })
  resumeFilename?: string;
  @ApiPropertyOptional({
    description: 'Cover letter filename (obtained from file upload)',
    example: 'john_doe_cover_letter.pdf',
  })
  @IsOptional()
  @Allow()
  @Transform(({ value }) => {
    if (typeof value === 'object' && value && typeof value.filename === 'string') {
      return value.filename;
    }
    if (typeof value === 'string') {
      return value;
    }
    return value;
  })
  coverLetterFilename?: string;
}
