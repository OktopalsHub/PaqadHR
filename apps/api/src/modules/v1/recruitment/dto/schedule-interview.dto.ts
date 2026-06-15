import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
export class ScheduleInterviewDto {
  @ApiProperty({ description: 'Candidate ID' })
  @IsNotEmpty()
  @IsUUID()
  candidateId: string;
  @ApiProperty({ description: 'Interviewer ID' })
  @IsNotEmpty()
  @IsUUID()
  interviewerId: string;
  @ApiProperty({ description: 'Interview date and time' })
  @IsNotEmpty()
  @IsDateString()
  scheduledAt: string;
  @ApiProperty({
    description: 'Interview duration in minutes',
    required: false,
    default: 60,
  })
  @IsOptional()
  duration?: number;
  @ApiProperty({
    description: 'Interview type',
    required: false,
    enum: ['phone', 'video', 'onsite', 'technical', 'behavioral'],
  })
  @IsOptional()
  @IsString()
  type?: string;
  @ApiProperty({
    description: 'Interview location or platform',
    required: false,
  })
  @IsOptional()
  @IsString()
  location?: string;
  @ApiProperty({
    description: 'Interview notes or instructions',
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;
  @ApiProperty({
    description: 'Interview round number',
    required: false,
    default: 1,
  })
  @IsOptional()
  round?: number;
}
