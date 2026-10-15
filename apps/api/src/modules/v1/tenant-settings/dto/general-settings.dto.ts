import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class GeneralSettingsDto {
  @ApiProperty({
    description: 'Timezone for the tenant',
    example: 'UTC',
  })
  @IsString()
  timezone: string;
  @ApiProperty({
    description: 'Date format preference',
    example: 'YYYY-MM-DD',
  })
  @IsString()
  dateFormat: string;
  @ApiProperty({
    description: 'Currency code',
    example: 'USD',
  })
  @IsString()
  currency: string;
  @ApiProperty({
    description: 'Payroll bank account currencies allowed for members',
    example: ['USD', 'NGN'],
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  payrollCurrencies?: string[];
  @ApiProperty({
    description: 'Language preference',
    example: 'en',
  })
  @IsString()
  language: string;
  @ApiProperty({
    description: 'Company name',
    example: 'Acme Corporation',
  })
  @IsString()
  companyName: string;
  @ApiProperty({
    description: 'Default pagination limit',
    example: 10,
    minimum: 5,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(100)
  paginationLimit?: number;
  @ApiProperty({
    description: 'Send email when payslips are published to employees',
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  emailPayslipOnPublish?: boolean;

  @ApiProperty({
    description: 'Allow crypto currency payout methods in workspace',
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  cryptoEnabled?: boolean;
}
export class EmployeeSettingsDto {
  @ApiProperty({
    description: 'Employee number prefix',
    example: 'EMP',
  })
  @IsOptional()
  @IsString()
  numberPrefix?: string;
  @ApiProperty({
    description: 'Employee number padding length',
    example: 3,
    minimum: 1,
    maximum: 10,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  numberPadding?: number;

  @ApiProperty({
    description: 'Require employee BVN or NIN before payroll payout',
    required: false,
  })
  @IsOptional()
  requireIdentityForPayroll?: boolean;
}
export class HolidayDto {
  @ApiProperty({
    description: 'Holiday ID',
    example: 'ng-christmas',
  })
  @IsString()
  id: string;
  @ApiProperty({
    description: 'Holiday name',
    example: 'Christmas Day',
  })
  @IsString()
  name: string;
  @ApiProperty({
    description: 'Holiday date (YYYY-MM-DD for specific dates, MM-DD for recurring)',
    example: '12-25',
  })
  @IsString()
  date: string;
  @ApiProperty({
    description: 'Holiday type',
    example: 'religious',
    enum: ['national', 'religious', 'custom'],
  })
  @IsString()
  type: 'national' | 'religious' | 'custom';
  @ApiProperty({
    description: 'Whether this holiday recurs yearly',
    example: true,
  })
  @IsBoolean()
  recurring: boolean;
}

export class CreateCustomHolidayDto {
  @ApiProperty({
    description: 'Holiday name',
    example: 'Company Founders Day',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Holiday date (MM-DD for recurring custom holidays)',
    example: '03-15',
  })
  @IsString()
  date: string;

  @ApiProperty({
    description: 'Holiday type (must be custom for this endpoint)',
    example: 'custom',
    enum: ['custom'],
  })
  @IsIn(['custom'])
  type: 'custom';

  @ApiProperty({
    description: 'Whether this holiday recurs yearly',
    example: true,
  })
  @IsBoolean()
  recurring: boolean;
}

export class HolidaySettingsDto {
  @ApiProperty({
    description: 'ISO country code for public holidays on the schedule calendar',
    example: 'NG',
    required: false,
  })
  @IsOptional()
  @IsString()
  countryCode?: string;
  @ApiProperty({
    description: 'Custom holidays for this tenant',
    type: [HolidayDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HolidayDto)
  customHolidays?: HolidayDto[];
  @ApiProperty({
    description: 'Whether to exclude weekends from leave calculations',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  excludeWeekends?: boolean;
}
