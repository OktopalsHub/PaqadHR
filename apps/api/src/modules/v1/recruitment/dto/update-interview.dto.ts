import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

class InterviewerDto {
  @ApiPropertyOptional({
    description: 'Interviewer user ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiProperty({
    description: 'user id',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  userId: string;
  @ApiPropertyOptional({
    description: 'Interviewer role',
    example: 'Senior Developer',
  })
  @ApiProperty({
    description: 'role',
  })
  @IsString()
  role: string;
}
export class UpdateInterviewDto {
  @ApiPropertyOptional({
    description: 'Interview type',
    enum: ['PHONE', 'VIDEO', 'ONSITE'],
    example: 'VIDEO',
  })
  @IsEnum(['PHONE', 'VIDEO', 'ONSITE'])
  @ApiProperty({
    description: 'type',
    required: false,
  })
  @IsOptional()
  type?: 'PHONE' | 'VIDEO' | 'ONSITE';
  @ApiPropertyOptional({
    description: 'Interview date and time',
    example: '2024-12-15T10:00:00.000Z',
  })
  @IsDateString()
  @ApiProperty({
    description: 'date',
    required: false,
    example: '2023-12-01T10:00:00Z',
  })
  @IsOptional()
  date?: string;
  @ApiPropertyOptional({
    description: 'Interview duration in minutes',
    minimum: 15,
    maximum: 480,
    example: 60,
  })
  @IsNumber()
  @Min(15)
  @Max(480)
  @ApiPropertyOptional({
    description: 'duration',
    required: false,
    example: 100,
  })
  @IsOptional()
  duration?: number;
  @ApiPropertyOptional({
    description: 'Interviewers',
    type: [InterviewerDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InterviewerDto)
  @ApiPropertyOptional({
    description: 'interviewers',
    required: false,
  })
  @IsOptional()
  interviewers?: InterviewerDto[];
  @ApiPropertyOptional({
    description: 'Interview location',
    example: 'Conference Room A',
  })
  @IsString()
  @ApiPropertyOptional({
    description: 'location',
    required: false,
  })
  @IsOptional()
  location?: string;
  @ApiPropertyOptional({
    description: 'Additional notes',
    example: 'Please bring a laptop for coding test',
  })
  @IsString()
  @ApiPropertyOptional({
    description: 'notes',
    required: false,
  })
  @IsOptional()
  notes?: string;
  @ApiPropertyOptional({
    description: 'Interview status',
    enum: ['SCHEDULED', 'COMPLETED', 'CANCELLED'],
    example: 'SCHEDULED',
  })
  @IsEnum(['SCHEDULED', 'COMPLETED', 'CANCELLED'])
  @ApiPropertyOptional({
    description: 'status',
    required: false,
  })
  @IsOptional()
  status?: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
}
