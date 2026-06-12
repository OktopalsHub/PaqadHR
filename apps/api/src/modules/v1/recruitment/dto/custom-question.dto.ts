import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsUUID,
  IsNotEmpty,
  IsString,
  IsEnum,
  IsBoolean,
  IsArray,
  IsNumber,
} from 'class-validator';
import { QuestionType } from 'src/common/enums';
export class CustomQuestionDto {
  @ApiProperty({ description: 'Unique identifier for the question' })
  @IsOptional()
  @IsUUID()
  id?: string;
  @ApiProperty({ description: 'The question text' })
  @IsNotEmpty()
  @IsString()
  questionText: string;
  @ApiProperty({
    description: 'Optional description for the question',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;
  @ApiProperty({ enum: QuestionType, description: 'Type of question' })
  @IsNotEmpty()
  @IsEnum(QuestionType)
  questionType: QuestionType;
  @ApiProperty({ description: 'Whether this question is required' })
  @IsBoolean()
  isRequired: boolean;
  @ApiProperty({
    type: [String],
    description: 'Options for choice questions',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];
  @ApiProperty({
    description: 'Maximum rating for rating questions',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  maxRating?: number;
}
