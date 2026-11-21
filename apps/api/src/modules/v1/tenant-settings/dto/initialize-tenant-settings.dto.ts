import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { UpdateTenantSettingsDto } from './tenant-settings.dto';

export class InitializeTenantSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  companyName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(16)
  language?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  monthlyPointsAllowance?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enableNotifications?: boolean;

  @ApiPropertyOptional({ type: UpdateTenantSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateTenantSettingsDto)
  customSettings?: UpdateTenantSettingsDto;
}

export class InitializeTenantWorkspaceDto extends InitializeTenantSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  initializeMemberPoints?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  initialPointsOverride?: number;
}
