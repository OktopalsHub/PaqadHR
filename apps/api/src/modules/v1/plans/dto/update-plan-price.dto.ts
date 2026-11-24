import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, Max, Min, ValidateNested } from 'class-validator';

import { PlanRegionalConfigDto } from './plan-regional-config.dto';

export class UpdatePlanPriceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000_000)
  monthlyPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000_000)
  yearlyPrice?: number;

  @ApiPropertyOptional({ type: PlanRegionalConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PlanRegionalConfigDto)
  regionalConfig?: PlanRegionalConfigDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
