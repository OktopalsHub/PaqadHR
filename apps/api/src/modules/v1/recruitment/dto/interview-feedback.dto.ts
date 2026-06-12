import { Candidate } from '../entities/candidate.entity';
import { Interview } from '../entities/interview.entity';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsString,
  Max,
  Min,
} from 'class-validator';
export class InterviewFeedbackDto {
  @ApiProperty({
    description: 'Interview rating (1-10)',
    minimum: 1,
    maximum: 10,
    example: 8,
  })
  @IsNumber()
  @Min(1)
  @Max(10)
  rating: number;
  @ApiProperty({
    description: 'Candidate strengths',
    type: [String],
    example: [
      'Strong technical skills',
      'Good communication',
      'Problem-solving ability',
    ],
  })
  @IsArray()
  @ApiProperty({
    description: 'strengths',
  })
  @IsString({ each: true })
  strengths: string[];
  @ApiProperty({
    description: 'Candidate weaknesses',
    type: [String],
    example: ['Limited experience with React', 'Could improve time management'],
  })
  @IsArray()
  @ApiProperty({
    description: 'weaknesses',
  })
  @IsString({ each: true })
  weaknesses: string[];
  @ApiProperty({
    description: 'Additional notes',
    example:
      'Candidate shows potential but needs more experience with our tech stack.',
  })
  @IsString()
  @ApiProperty({
    description: 'notes',
  })
  @IsNotEmpty()
  notes: string;
}
