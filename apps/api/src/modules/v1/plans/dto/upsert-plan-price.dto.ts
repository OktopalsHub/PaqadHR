import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { PlanRegionalConfigDto } from './plan-regional-config.dto';

export class UpsertPlanPriceDto {
  @ApiProperty()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(100)
  slug: string;

  @ApiProperty()
  @IsString()
  @Length(1, 150)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty()
  @IsString()
  @Length(2, 10)
  countryCode: string;

  @ApiProperty()
  @IsString()
  @Length(3, 3)
  currency: string;

  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000_000)
  monthlyPrice: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000_000)
  yearlyPrice?: number;

  @ApiProperty({ type: PlanRegionalConfigDto })
  @ValidateNested()
  @Type(() => PlanRegionalConfigDto)
  regionalConfig: PlanRegionalConfigDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  features?: Record<string, boolean>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  limits?: Record<string, number>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000)
  sortOrder?: number;
}
