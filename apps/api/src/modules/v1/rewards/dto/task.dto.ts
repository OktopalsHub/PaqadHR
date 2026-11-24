import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export const TASK_SUBMISSION_TYPES = ['instant', 'text', 'file'] as const;
export type TaskSubmissionType = (typeof TASK_SUBMISSION_TYPES)[number];
export const TASK_MAX_POINTS = 1_000_000;

export class CreateTaskDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  description!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(TASK_MAX_POINTS)
  points!: number;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  icon!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(2000)
  imageUrl?: string;

  @ApiProperty({ enum: TASK_SUBMISSION_TYPES })
  @IsIn(TASK_SUBMISSION_TYPES)
  submissionType!: TaskSubmissionType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;
}

export class UpdateTaskDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(TASK_MAX_POINTS)
  points?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  icon?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(2000)
  imageUrl?: string;

  @ApiPropertyOptional({ enum: TASK_SUBMISSION_TYPES })
  @IsOptional()
  @IsIn(TASK_SUBMISSION_TYPES)
  submissionType?: TaskSubmissionType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;
}

export class SubmitTaskDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  submissionText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  submissionFileName?: string;
}
