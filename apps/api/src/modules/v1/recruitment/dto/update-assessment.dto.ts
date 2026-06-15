import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

class UpdateQuestionDto {
  @ApiPropertyOptional({
    description: 'Question text',
    example: 'What is the difference between let, const, and var in JavaScript? ',
  })
  @IsString()
  @ApiProperty({
    description: 'question',
    required: false,
  })
  @IsOptional()
  question?: string;
  @ApiPropertyOptional({
    description: 'Question type',
    enum: ['MULTIPLE_CHOICE', 'TEXT', 'BOOLEAN', 'RATING'],
    example: 'MULTIPLE_CHOICE',
  })
  @IsString()
  @ApiProperty({
    description: 'type',
    required: false,
  })
  @IsOptional()
  type?: 'MULTIPLE_CHOICE' | 'TEXT' | 'BOOLEAN' | 'RATING';
  @ApiPropertyOptional({
    description: 'Answer options for multiple choice questions',
    type: [String],
    example: ['let is block-scoped', 'const is block-scoped', 'var is function-scoped'],
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
export class UpdateAssessmentDto {
  @ApiPropertyOptional({
    description: 'Assessment type',
    example: 'Technical Skills',
  })
  @IsString()
  @ApiProperty({
    description: 'type',
    required: false,
  })
  @IsOptional()
  type?: string;
  @ApiPropertyOptional({
    description: 'Assessment title',
    example: 'JavaScript Fundamentals',
  })
  @IsString()
  @ApiProperty({
    description: 'title',
    required: false,
  })
  @IsOptional()
  title?: string;
  @ApiPropertyOptional({
    description: 'Assessment description',
    example: 'Test covering JavaScript fundamentals including variables, functions, and objects',
  })
  @IsString()
  @ApiProperty({
    description: 'description',
    required: false,
  })
  @IsOptional()
  description?: string;
  @ApiPropertyOptional({
    description: 'Assessment questions',
    type: [UpdateQuestionDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateQuestionDto)
  @ApiProperty({
    description: 'questions',
    required: false,
  })
  @IsOptional()
  questions?: UpdateQuestionDto[];
  @ApiPropertyOptional({
    description: 'Assessment duration in minutes',
    minimum: 5,
    maximum: 480,
    example: 30,
  })
  @IsNumber()
  @Min(5)
  @Max(480)
  @ApiProperty({
    description: 'duration',
    required: false,
    example: 100,
  })
  @IsOptional()
  duration?: number;
  @ApiPropertyOptional({
    description: 'Passing score (percentage)',
    minimum: 0,
    maximum: 100,
    example: 70,
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  @ApiProperty({
    description: 'passing score',
    required: false,
    example: 100,
  })
  @IsOptional()
  passingScore?: number;
  @ApiPropertyOptional({
    description: 'Whether the assessment is active',
    example: true,
  })
  @IsBoolean()
  @ApiProperty({
    description: 'is active',
    required: false,
    example: true,
  })
  @IsOptional()
  isActive?: boolean;
}
