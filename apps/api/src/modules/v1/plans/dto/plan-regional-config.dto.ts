import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsObject, IsOptional, Max, Min } from 'class-validator';

export class PlanRegionalConfigDto {
  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(1_000_000_000)
  pricePerUser: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  minimumUsers: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  includedUsers: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(1_000_000_000)
  overagePricePerUser: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(100)
  payrollFeePercentage: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  rewardsFeePercentage?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000_000)
  rewardsFlatFee?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  featureLimits?: Record<string, number>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  regionalFeatures?: Record<string, unknown>;
}
