import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { SUPPORTED_FIAT_CURRENCIES } from 'src/common/constants/supported-fiat-currencies.constant';

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
    description: 'How often shoutout points allowance resets',
    example: 'monthly',
    enum: ['weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'],
    required: false,
  })
  @IsOptional()
  @IsString()
  allowancePeriod?: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
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
  @ApiProperty({
    description: 'Automated birthday shoutout settings',
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ShoutoutCelebrationTemplateDto)
  birthday?: ShoutoutCelebrationTemplateDto;
  @ApiProperty({
    description: 'Automated work anniversary shoutout settings',
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ShoutoutCelebrationTemplateDto)
  workAnniversary?: ShoutoutCelebrationTemplateDto;
}
export class ShoutoutCelebrationTemplateDto {
  @ApiProperty({ description: 'Whether this celebration shoutout is enabled', required: false })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
  @ApiProperty({ description: 'Points to award the celebrant', required: false, minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  points?: number;
  @ApiProperty({
    description: 'Message template. Placeholders: {name}, {years}, {company}',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  messageTemplate?: string;
}
export class AttendanceSettingsDto {
  @ApiProperty({
    description: 'Weekend days (0=Sunday, 1=Monday, etc.)',
    example: [0, 6],
    type: [Number],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  weekends?: number[];

  @ApiProperty({
    description: 'Allow members to clock in and out from the app',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  clockInEnabled?: boolean;
}
export class BillingSettingsDto {
  @ApiProperty({ description: 'Billing contact name', example: 'Jane Doe', required: false })
  @IsOptional()
  @IsString()
  contactName?: string;

  @ApiProperty({
    description: 'Billing contact email',
    example: 'billing@company.com',
    required: false,
  })
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiProperty({ description: 'Billing contact phone', required: false })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiProperty({ description: 'Address line 1', required: false })
  @IsOptional()
  @IsString()
  addressLine1?: string;

  @ApiProperty({ description: 'Address line 2', required: false })
  @IsOptional()
  @IsString()
  addressLine2?: string;

  @ApiProperty({ description: 'City', required: false })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiProperty({ description: 'Country', required: false })
  @IsOptional()
  @IsString()
  country?: string;
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
export class RewardsSettingsDto {
  @ApiProperty({
    description: 'Whether the rewards redemption system is enabled',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiProperty({ description: 'Points-to-currency exchange rate', example: 1, required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  pointsExchangeRate?: number;

  @ApiProperty({ description: 'The currency code for rewards', example: 'NGN', required: false })
  @IsOptional()
  @IsString()
  @IsIn([...SUPPORTED_FIAT_CURRENCIES])
  rewardsCurrency?: string;

  @ApiProperty({
    description: 'Allowed ISO country codes for Reloadly gift cards',
    type: [String],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  catalogCountries?: string[];

  @ApiProperty({
    description: 'Whether Nomba airtime vending is enabled',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  airtimeEnabled?: boolean;

  @ApiProperty({
    description: 'Whether custom rewards are enabled',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  customRewardsEnabled?: boolean;

  @ApiProperty({
    description: 'Whether gift cards rewards are enabled',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  giftCardsEnabled?: boolean;

  @ApiProperty({
    description: 'Allowed gift card categories to show',
    type: [String],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  giftCardCategories?: string[];

  @ApiProperty({
    description: 'Whether utility payments are enabled',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  utilityPaymentsEnabled?: boolean;

  @ApiProperty({
    description: 'Active configured Reloadly gift card products',
    type: [Object],
    required: false,
  })
  @IsOptional()
  @IsArray()
  reloadlyProducts?: Array<{
    productId: number;
    name: string;
    pointsCost: number;
    imageUrl: string | null;
    countryCode: string;
    currencyCode: string;
    minDenomination?: number | null;
    maxDenomination?: number | null;
    fixedDenominations?: number[];
  }>;
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
  @ApiProperty({
    description: 'Billing contact and address',
    type: BillingSettingsDto,
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => BillingSettingsDto)
  billing?: BillingSettingsDto;
  @ApiProperty({
    description: 'Rewards configuration settings',
    type: RewardsSettingsDto,
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => RewardsSettingsDto)
  rewards?: RewardsSettingsDto;
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
