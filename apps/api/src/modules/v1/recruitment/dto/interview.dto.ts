import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { InterviewStatus, InterviewType } from 'src/common/enums';
export class InterviewerDto {
  @ApiProperty({ description: 'User ID of the interviewer' })
  @IsNotEmpty()
  @IsUUID()
  userId: string;
  @ApiProperty({
    description: 'Role of the interviewer (e.g., "Technical Lead", "HR Manager")',
  })
  @IsNotEmpty()
  @IsString()
  role: string;
}
export class InterviewFeedbackDto {
  @ApiProperty({ description: 'User ID of the person providing feedback' })
  @IsNotEmpty()
  @IsUUID()
  userId: string;
  @ApiProperty({ description: 'Rating out of 10', minimum: 1, maximum: 10 })
  @IsNumber()
  @Min(1)
  @Max(10)
  rating: number;
  @ApiProperty({ type: [String], description: 'Candidate strengths' })
  @IsArray()
  @IsString({ each: true })
  strengths: string[];
  @ApiProperty({ type: [String], description: 'Areas for improvement' })
  @IsArray()
  @IsString({ each: true })
  weaknesses: string[];
  @ApiProperty({ description: 'Additional notes' })
  @IsNotEmpty()
  @IsString()
  notes: string;
  @ApiProperty({ description: 'Timestamp when feedback was submitted' })
  @IsDateString()
  submittedAt: Date;
}
export class CreateInterviewDto {
  @ApiProperty({ description: 'Candidate ID' })
  @IsNotEmpty()
  @IsUUID()
  candidateId: string;
  @ApiProperty({ description: 'Job Opening ID' })
  @IsNotEmpty()
  @IsUUID()
  jobOpeningId: string;
  @ApiProperty({ enum: InterviewType, description: 'Type of interview' })
  @IsNotEmpty()
  @IsEnum(InterviewType)
  type: InterviewType;
  @ApiProperty({ description: 'Interview date and time' })
  @IsNotEmpty()
  @IsDateString()
  @Transform(({ value }) => new Date(value))
  date: Date;
  @ApiProperty({ description: 'Duration in minutes', minimum: 15 })
  @IsNotEmpty()
  @IsNumber()
  @Min(15)
  duration: number;
  @ApiProperty({
    type: [InterviewerDto],
    description: 'List of interviewers',
    minItems: 1,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InterviewerDto)
  interviewers: InterviewerDto[];
  @ApiProperty({
    description: 'Interview location (for onsite) or meeting link (for video)',
    required: false,
  })
  @IsOptional()
  @IsString()
  location?: string;
  @ApiProperty({ description: 'Additional notes', required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
export class UpdateInterviewDto {
  @ApiProperty({
    enum: InterviewType,
    description: 'Type of interview',
    required: false,
  })
  @IsOptional()
  @IsEnum(InterviewType)
  type?: InterviewType;
  @ApiProperty({
    enum: InterviewStatus,
    description: 'Interview status',
    required: false,
  })
  @IsOptional()
  @IsEnum(InterviewStatus)
  status?: InterviewStatus;
  @ApiProperty({ description: 'Interview date and time', required: false })
  @IsOptional()
  @IsDateString()
  @Transform(({ value }) => new Date(value))
  date?: Date;
  @ApiProperty({
    description: 'Duration in minutes',
    minimum: 15,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(15)
  duration?: number;
  @ApiProperty({
    type: [InterviewerDto],
    description: 'List of interviewers',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InterviewerDto)
  interviewers?: InterviewerDto[];
  @ApiProperty({
    description: 'Interview location or meeting link',
    required: false,
  })
  @IsOptional()
  @IsString()
  location?: string;
  @ApiProperty({ description: 'Additional notes', required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
export class AddFeedbackDto {
  @ApiProperty({ description: 'Rating out of 10', minimum: 1, maximum: 10 })
  @IsNumber()
  @Min(1)
  @Max(10)
  rating: number;
  @ApiProperty({ type: [String], description: 'Candidate strengths' })
  @IsArray()
  @IsString({ each: true })
  strengths: string[];
  @ApiProperty({ type: [String], description: 'Areas for improvement' })
  @IsArray()
  @IsString({ each: true })
  weaknesses: string[];
  @ApiProperty({ description: 'Additional notes' })
  @IsNotEmpty()
  @IsString()
  notes: string;
}
export class InterviewFiltersDto {
  @ApiProperty({ enum: InterviewStatus, required: false })
  @IsOptional()
  @IsEnum(InterviewStatus)
  status?: InterviewStatus;
  @ApiProperty({ enum: InterviewType, required: false })
  @IsOptional()
  @IsEnum(InterviewType)
  type?: InterviewType;
  @ApiProperty({
    description: 'Filter from date (ISO string)',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;
  @ApiProperty({ description: 'Filter to date (ISO string)', required: false })
  @IsOptional()
  @IsDateString()
  dateTo?: string;
  @ApiProperty({ description: 'Filter by candidate ID', required: false })
  @IsOptional()
  @IsUUID()
  candidateId?: string;
  @ApiProperty({ description: 'Filter by job opening ID', required: false })
  @IsOptional()
  @IsUUID()
  jobOpeningId?: string;
  @ApiProperty({ description: 'Filter by interviewer ID', required: false })
  @IsOptional()
  @IsUUID()
  interviewerId?: string;
}
export class InterviewResponseDto {
  @ApiProperty()
  id: string;
  @ApiProperty()
  candidateId: string;
  @ApiProperty()
  jobOpeningId: string;
  @ApiProperty({ enum: InterviewType })
  type: InterviewType;
  @ApiProperty({ enum: InterviewStatus })
  status: InterviewStatus;
  @ApiProperty()
  date: Date;
  @ApiProperty()
  duration: number;
  @ApiProperty({ type: [InterviewerDto] })
  interviewers: InterviewerDto[];
  @ApiProperty({ required: false })
  location?: string;
  @ApiProperty({ type: [InterviewFeedbackDto], required: false })
  feedback?: InterviewFeedbackDto[];
  @ApiProperty({ required: false })
  notes?: string;
  @ApiProperty()
  createdAt: Date;
  @ApiProperty()
  updatedAt: Date;
  candidate?: unknown;
  jobOpening?: unknown;
}
export class InterviewStatsResponseDto {
  @ApiProperty()
  total: number;
  @ApiProperty()
  scheduled: number;
  @ApiProperty()
  completed: number;
  @ApiProperty()
  cancelled: number;
  @ApiProperty({
    type: 'object',
    properties: {
      phone: { type: 'number' },
      video: { type: 'number' },
      onsite: { type: 'number' },
    },
  })
  byType: {
    phone: number;
    video: number;
    onsite: number;
  };
  @ApiProperty()
  averageDuration: number;
}
