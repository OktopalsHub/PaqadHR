import { Department } from '../../departments/entities/department.entity';
import { Employment } from '../../employment/entities/employment.entity';
import { Position } from '../../position/entities/position.entity';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { EmploymentType, JobStatus } from 'src/common/enums';
import { JobLocationDto } from "./job-location.dto";
import { CustomQuestionDto } from "./index";

export class UpdateJobOpeningDto {
  @ApiPropertyOptional({
    description: 'Job title',
    example: 'Senior Software Engineer',
  })
  @IsString()
  @IsOptional()
  title?: string;
  @ApiPropertyOptional({
    description: 'Department ID',
    example: 'uuid-of-department',
  })
  @IsUUID(4, { message: 'Department ID must be a valid UUID' })
  @IsOptional()
  departmentId?: string;
  @ApiPropertyOptional({
    description: 'Position name',
    example: 'Software Engineer',
  })
  @IsString()
  @IsOptional()
  position?: string;
  @ApiPropertyOptional({
    description: 'Location information',
    type: JobLocationDto,
  })
  @ValidateNested()
  @Type(() => JobLocationDto)
  @IsOptional()
  location?: JobLocationDto;
  @ApiPropertyOptional({
    enum: EmploymentType,
    description: 'Employment type (Full-time, Part-time, Contract, etc.)',
    example: EmploymentType.FULL_TIME,
  })
  @IsEnum(EmploymentType)
  @IsOptional()
  employmentType?: EmploymentType;
  @ApiPropertyOptional({
    description:
      'Experience level required (e.g., "Entry Level", "Mid-Level", "Senior", "Lead", "Executive", or custom level)',
    example: 'Senior',
  })
  @IsString()
  @IsOptional()
  experienceLevel?: string;
  @ApiPropertyOptional({
    description: 'Minimum salary',
    example: 50000,
  })
  @IsOptional()
  @IsNumber()
  minimumSalary?: number;
  @ApiPropertyOptional({
    description: 'Maximum salary',
    example: 80000,
  })
  @IsOptional()
  @IsNumber()
  maximumSalary?: number;
  @ApiPropertyOptional({
    description: 'Salary currency',
    example: 'USD',
  })
  @IsOptional()
  @IsString()
  currency?: string;
  @ApiPropertyOptional({
    description: 'Application deadline',
    example: '2024-12-31T23:59:59.000Z',
  })
  @IsOptional()
  @IsDateString()
  applicationDeadline?: Date;
  @ApiPropertyOptional({
    description: 'Mark this job as urgent hiring',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isUrgent?: boolean;
  @ApiPropertyOptional({
    description: 'Job description',
    example:
      'We are looking for a Senior Software Engineer to join our team...',
  })
  @IsString()
  @IsOptional()
  description?: string;
  @ApiPropertyOptional({
    description: 'Key responsibilities',
    type: [String],
    example: [
      'Develop new features',
      'Code review',
      'Mentor junior developers',
    ],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  responsibilities?: string[];
  @ApiPropertyOptional({
    description: 'Job requirements',
    type: [String],
    example: ['5+ years of experience', 'Strong problem-solving skills'],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  requirements?: string[];
  @ApiPropertyOptional({
    description: 'Preferred qualifications',
    type: [String],
    example: ['Experience with microservices', 'Leadership experience'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredQualifications?: string[];
  @ApiPropertyOptional({
    description: 'Required skills',
    type: [String],
    example: ['JavaScript', 'React', 'Node.js'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredSkills?: string[];
  @ApiPropertyOptional({
    description: 'Job benefits',
    type: [String],
    example: ['Health insurance', '401k', 'Remote work'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  benefits?: string[];
  @ApiPropertyOptional({
    description: 'Job opening status',
    enum: JobStatus,
    example: JobStatus.ACTIVE,
  })
  @IsEnum(JobStatus)
  @IsOptional()
  status?: JobStatus;
  @ApiPropertyOptional({
    description: 'Number of job openings',
    example: 2,
  })
  @IsOptional()
  @IsNumber()
  numberOfOpenings?: number;
  @ApiPropertyOptional({
    description: 'Custom application questions',
    type: [CustomQuestionDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomQuestionDto)
  customQuestions?: CustomQuestionDto[];
}
