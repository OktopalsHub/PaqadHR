import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsISO31661Alpha2, IsOptional, IsString, Length, MaxLength } from 'class-validator';

const upper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class SetTenantRegionDto {
  @ApiProperty({ example: 'NG' })
  @Transform(upper)
  @IsISO31661Alpha2()
  countryCode: string;

  @ApiPropertyOptional({ example: 'Africa/Lagos' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @ApiPropertyOptional({ example: 'NGN' })
  @IsOptional()
  @Transform(upper)
  @IsString()
  @Length(3, 3)
  preferredCurrency?: string;
}

export class OnboardingRegionDto {
  @ApiPropertyOptional({ example: 'NG' })
  @IsOptional()
  @Transform(upper)
  @IsISO31661Alpha2()
  userSelectedCountry?: string;
}
