import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { EmploymentType } from 'src/common/enums';
import { CustomQuestionDto } from './index';
import { JobLocationDto } from './job-location.dto';

export class CreateJobOpeningDto {
  @ApiProperty({
    description: 'Job title',
    example: 'Senior Software Engineer',
  })
  @IsString({ message: 'Job title must be a text value' })
  @IsNotEmpty({ message: 'Job title is required' })
  title: string;
  @ApiPropertyOptional({
    description: 'Department ID (optional — jobs are tenant-scoped)',
    example: 'uuid-of-department',
  })
  @IsOptional()
  @IsUUID(4, { message: 'Department ID must be a valid UUID' })
  departmentId?: string;
  @ApiProperty({
    description: 'Position name',
    example: 'Software Engineer',
  })
  @IsString()
  @IsNotEmpty()
  position: string;
  @ApiProperty({
    description: 'Location information',
    type: JobLocationDto,
  })
  @ValidateNested()
  @Type(() => JobLocationDto)
  location: JobLocationDto;
  @ApiProperty({
    enum: EmploymentType,
    description: 'Employment type (Full-time, Part-time, Contract, etc.)',
    example: EmploymentType.FULL_TIME,
  })
  @IsEnum(EmploymentType)
  @IsNotEmpty()
  employmentType: EmploymentType;
  @ApiProperty({
    description:
      'Experience level required (e.g., "Entry Level", "Mid-Level", "Senior", "Lead", "Executive", or custom level)',
    example: 'Mid-Level',
  })
  @IsString({ message: 'Experience level must be a text value' })
  @IsNotEmpty({ message: 'Experience level is required' })
  experienceLevel: string;
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
  @ApiProperty({
    description: 'Job description',
    example: 'We are looking for a Senior Software Engineer to join our team...',
  })
  @IsString({ message: 'Job description must be a text value' })
  @IsNotEmpty({ message: 'Job description is required' })
  description: string;
  @ApiProperty({
    description: 'Key responsibilities',
    type: [String],
    example: ['Develop new features', 'Code review', 'Mentor junior developers'],
  })
  @IsArray()
  @IsString({ each: true })
  responsibilities: string[];
  @ApiProperty({
    description: 'Job requirements',
    type: [String],
    example: ['5+ years of experience', 'Strong problem-solving skills'],
  })
  @IsArray()
  @IsString({ each: true })
  requirements: string[];
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
