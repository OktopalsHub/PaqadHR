import { Assessment } from '../entities/assessment.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
class QuestionDto {
  @ApiProperty({
    description: 'Question text',
    example:
      'What is the difference between let, const, and var in JavaScript?',
  })
  @IsString()
  @ApiProperty({
    description: 'question',
  })
  @IsNotEmpty()
  question: string;
  @ApiProperty({
    description: 'Question type',
    enum: ['MULTIPLE_CHOICE', 'TEXT', 'BOOLEAN', 'RATING'],
    example: 'MULTIPLE_CHOICE',
  })
  @IsString()
  @ApiProperty({
    description: 'type',
  })
  @IsNotEmpty()
  type: 'MULTIPLE_CHOICE' | 'TEXT' | 'BOOLEAN' | 'RATING';
  @ApiPropertyOptional({
    description: 'Answer options for multiple choice questions',
    type: [String],
    example: [
      'let is block-scoped',
      'const is block-scoped',
      'var is function-scoped',
    ],
  })
  @IsArray()
  @IsString({ each: true })
  @ApiProperty({
    description: 'options',
    required: false,
  })
  @IsOptional()
  options?: string[];
  @ApiPropertyOptional({
    description: 'Correct answer for scoring',
    example: 'let is block-scoped',
  })
  @IsString()
  @ApiProperty({
    description: 'correct answer',
    required: false,
  })
  @IsOptional()
  correctAnswer?: string;
}
export class CreateAssessmentDto {
  @ApiProperty({ description: 'Assessment name' })
  @ApiProperty({
    description: 'type',
  })
  @IsNotEmpty()
  @IsString()
  @ApiProperty({
    description: 'title',
  })
  name: string;
  @ApiProperty({ description: 'Assessment description' })
  @IsNotEmpty()
  @IsString()
  @ApiProperty({
    description: 'description',
  })
  description: string;
  @ApiProperty({ description: 'Assessment instructions', required: false })
  @IsOptional()
  @IsString()
  instructions?: string;
  @ApiProperty({ description: 'Time limit in minutes', required: false })
  @IsOptional()
  @IsNumber()
  timeLimit?: number;
  @ApiProperty({
    description: 'Passing score percentage',
    required: false,
    default: 70,
  })
  @IsOptional()
  @IsNumber()
  passingScore?: number;
  @ApiProperty({ description: 'Assessment questions', required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  questions?: string[];
  @ApiProperty({ description: 'Assessment criteria', required: false })
  @ApiProperty({
    description: 'is active',
    required: false,
    example: true,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  criteria?: string[];
}
