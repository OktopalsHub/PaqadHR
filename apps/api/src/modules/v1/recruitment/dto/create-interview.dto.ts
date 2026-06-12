import { Candidate } from '../entities/candidate.entity';
import { Interview } from '../entities/interview.entity';
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsArray,
  IsNumber,
  IsOptional,
  IsDateString,
  IsUUID,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
class InterviewerDto {
  @ApiProperty({
    description: 'Interviewer user ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiProperty({
    description: 'user id',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  userId: string;
  @ApiProperty({
    description: 'Interviewer role',
    example: 'Senior Developer',
  })
  @IsString()
  @ApiProperty({
    description: 'role',
  })
  @IsNotEmpty()
  role: string;
}
export class CreateInterviewDto {
  @ApiProperty({
    description: 'Candidate ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiProperty({
    description: 'candidate id',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  candidateId: string;
  @ApiProperty({
    description: 'Job opening ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiProperty({
    description: 'job opening id',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  jobOpeningId: string;
  @ApiProperty({
    description: 'Interview type',
    enum: ['PHONE', 'VIDEO', 'ONSITE'],
    example: 'VIDEO',
  })
  @IsEnum(['PHONE', 'VIDEO', 'ONSITE'])
  type: 'PHONE' | 'VIDEO' | 'ONSITE';
  @ApiProperty({
    description: 'Interview date and time',
    example: '2024-12-15T10:00:00.000Z',
  })
  @ApiProperty({
    description: 'date',
    example: '2023-12-01T10:00:00Z',
  })
  @IsDateString()
  date: string;
  @ApiProperty({
    description: 'Interview duration in minutes',
    minimum: 15,
    maximum: 480,
    example: 60,
  })
  @IsNumber()
  @Min(15)
  @Max(480)
  duration: number;
  @ApiProperty({
    description: 'Interviewers',
    type: [InterviewerDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InterviewerDto)
  interviewers: InterviewerDto[];
  @ApiPropertyOptional({
    description: 'Interview location',
    example: 'Conference Room A',
  })
  @IsString()
  @ApiProperty({
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
  @ApiProperty({
    description: 'notes',
    required: false,
  })
  @IsOptional()
  notes?: string;
}
