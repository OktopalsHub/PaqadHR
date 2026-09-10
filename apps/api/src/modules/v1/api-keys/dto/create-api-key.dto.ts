import { ApiProperty } from '@nestjs/swagger';
import { API_KEY_SCOPES } from '@paqadhr/contracts';
import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateApiKeyDto {
  @ApiProperty({ example: 'HR automation bot' })
  @IsString()
  @MaxLength(120)
  name: string;

  @ApiProperty({ enum: API_KEY_SCOPES, isArray: true })
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(API_KEY_SCOPES, { each: true })
  scopes: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
