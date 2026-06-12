import { Assessment } from '../entities/assessment.entity';
import { Candidate } from '../entities/candidate.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
class AnswerDto {
  @ApiProperty({
    description: 'Question ID',
    example: 'q1',
  })
  @IsString()
  @ApiProperty({
    description: 'question id',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty()
  questionId: string;
  @ApiProperty({
    description: 'Answer text',
    example: 'let is block-scoped',
  })
  @IsString()
  @ApiProperty({
    description: 'answer',
  })
  @IsNotEmpty()
  answer: string;
}
export class AssessmentResultDto {
  @ApiProperty({
    description: 'Assessment score (percentage)',
    minimum: 0,
    maximum: 100,
    example: 85,
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  score: number;
  @ApiProperty({
    description: 'Assessment answers',
    type: [AnswerDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerDto)
  answers: AnswerDto[];
  @ApiPropertyOptional({
    description: 'Additional feedback',
    example:
      'Candidate performed well on technical questions but struggled with system design.',
  })
  @IsString()
  @ApiProperty({
    description: 'feedback',
    required: false,
  })
  @IsOptional()
  feedback?: string;
}
