import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

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
