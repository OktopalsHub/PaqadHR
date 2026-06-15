import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class PointsSettingsDto {
  @ApiProperty({
    description: 'Monthly points allowance for each member',
    example: 100,
    minimum: 0,
    maximum: 10000,
  })
  @IsNumber()
  @Min(0)
  @Max(10000)
  monthlyAllowance: number;
  @ApiProperty({
    description: 'Maximum points per shoutout',
    example: 50,
    minimum: 1,
    maximum: 1000,
  })
  @IsNumber()
  @Min(1)
  @Max(1000)
  maxPointsPerShoutout: number;
  @ApiProperty({
    description: 'Minimum points per shoutout',
    example: 1,
    minimum: 1,
    maximum: 100,
  })
  @IsNumber()
  @Min(1)
  @Max(100)
  minPointsPerShoutout: number;
  @ApiProperty({
    description: 'Whether to automatically assign points to all members',
    example: false,
  })
  @IsBoolean()
  autoAssignPoints: boolean;
  @ApiProperty({
    description: 'Amount of points to auto-assign when enabled',
    example: 0,
    minimum: 0,
    maximum: 1000,
  })
  @IsNumber()
  @Min(0)
  @Max(1000)
  autoAssignAmount: number;
  @ApiProperty({
    description: 'Starting balance for new members',
    example: 100,
    minimum: 0,
    maximum: 10000,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10000)
  startingBalance?: number;
  @ApiProperty({
    description: 'Daily points limit per member',
    example: 50,
    minimum: 1,
    maximum: 1000,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  dailyLimit?: number;
  @ApiProperty({
    description: 'Monthly points limit per member',
    example: 1000,
    minimum: 1,
    maximum: 50000,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50000)
  monthlyLimit?: number;
}
export class NotificationSettingsDto {
  @ApiProperty({
    description: 'Enable email notifications',
    example: true,
  })
  @IsBoolean()
  emailNotifications: boolean;
  @ApiProperty({
    description: 'Enable Slack notifications',
    example: false,
  })
  @IsBoolean()
  slackNotifications: boolean;
  @ApiProperty({
    description: 'Enable Discord notifications',
    example: false,
  })
  @IsBoolean()
  discordNotifications: boolean;
  @ApiProperty({
    description: 'Webhook URL for notifications',
    example: 'https://hooks.slack.com/services/...',
    required: false,
  })
  @IsOptional()
  @IsUrl()
  webhookUrl?: string;
}
export class ShoutoutSettingsDto {
  @ApiProperty({
    description: 'Maximum recipients per shoutout',
    example: 10,
    minimum: 1,
    maximum: 50,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  maxRecipientsPerShoutout?: number;
  @ApiProperty({
    description: 'Enable shoutout categories (core values)',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  enableCategories?: boolean;
}
export class AttendanceSettingsDto {
  @ApiProperty({
    description: 'Weekend days (0=Sunday, 1=Monday, etc.)',
    example: [0, 6],
    type: [Number],
  })
  @IsArray()
  @IsNumber({}, { each: true })
  weekends: number[];
}
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
export class HolidaySettingsDto {
  @ApiProperty({
    description: 'Custom holidays for this tenant',
    type: [HolidayDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HolidayDto)
  customHolidays: HolidayDto[];
  @ApiProperty({
    description: 'Whether to exclude weekends from leave calculations',
    example: true,
  })
  @IsBoolean()
  excludeWeekends: boolean;
}
export class UpdateTenantSettingsDto {
  @ApiProperty({
    description: 'Points-related settings',
    type: PointsSettingsDto,
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => PointsSettingsDto)
  points?: PointsSettingsDto;
  @ApiProperty({
    description: 'Notification settings',
    type: NotificationSettingsDto,
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationSettingsDto)
  notifications?: NotificationSettingsDto;
  @ApiProperty({
    description: 'Shoutout settings',
    type: ShoutoutSettingsDto,
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ShoutoutSettingsDto)
  shoutouts?: ShoutoutSettingsDto;
  @ApiProperty({
    description: 'General settings',
    type: GeneralSettingsDto,
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => GeneralSettingsDto)
  general?: GeneralSettingsDto;
  @ApiProperty({
    description: 'Attendance settings',
    type: AttendanceSettingsDto,
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => AttendanceSettingsDto)
  attendance?: AttendanceSettingsDto;
  @ApiProperty({
    description: 'Employee settings',
    type: EmployeeSettingsDto,
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => EmployeeSettingsDto)
  employee?: EmployeeSettingsDto;
  @ApiProperty({
    description: 'Holiday settings',
    type: HolidaySettingsDto,
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => HolidaySettingsDto)
  holidays?: HolidaySettingsDto;
}
export class AssignPointsDto {
  @ApiProperty({
    description: 'Amount of points to assign to all members',
    example: 50,
    minimum: 1,
    maximum: 1000,
  })
  @IsNumber()
  @Min(1)
  @Max(1000)
  points: number;
  @ApiProperty({
    description: 'Reason for assigning points',
    example: 'Monthly bonus points',
    required: false,
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
