import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  MinLength,
  IsIn,
} from 'class-validator';
export class UpdateTenantDto {
  @ApiProperty({
    description: 'Name of the tenant/organization',
    example: 'Acme Corporation Updated',
    minLength: 3,
    required: false,
  })
  @IsString()
  @MinLength(3)
  @IsOptional()
  name?: string;
  @ApiProperty({
    description: 'Logo key',
    example: 'logo_12794',
    required: false,
  })
  @IsString()
  @IsOptional()
  logoKey?: string;
  @ApiProperty({
    description: 'Unique slug identifier for the tenant',
    example: 'acme-corp-updated',
    minLength: 3,
    required: false,
  })
  @IsString()
  @IsOptional()
  @MinLength(3)
  slug?: string;
  @ApiProperty({
    description: 'Whether the tenant is active',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
  @ApiProperty({
    description: 'Preferred currency for payroll and payments',
    example: 'USD',
    enum: ['USD', 'EUR', 'GBP', 'NGN', 'KES', 'GHS', 'ZAR'],
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsIn(['USD', 'EUR', 'GBP', 'NGN', 'KES', 'GHS', 'ZAR'])
  preferredCurrency?: string;
  @ApiProperty({
    description: 'Country code (ISO 3166-1 alpha-2)',
    example: 'US',
    required: false,
  })
  @IsOptional()
  @IsString()
  countryCode?: string;
  @ApiProperty({
    description: 'Timezone for the organization',
    example: 'America/New_York',
    required: false,
  })
  @IsOptional()
  @IsString()
  timezone?: string;
}
