import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { AttendanceSettingsDto } from './attendance-settings.dto';
import { BillingSettingsDto } from './billing-settings.dto';
import {
  CreateCustomHolidayDto,
  EmployeeSettingsDto,
  GeneralSettingsDto,
  HolidaySettingsDto,
} from './general-settings.dto';
import { NotificationSettingsDto } from './notification-settings.dto';
import { PointsSettingsDto } from './points-settings.dto';
import { RewardsSettingsDto, ShoutoutSettingsDto } from './rewards-settings.dto';

export {
  AttendanceSettingsDto,
  BillingSettingsDto,
  CreateCustomHolidayDto,
  EmployeeSettingsDto,
  GeneralSettingsDto,
  HolidaySettingsDto,
  NotificationSettingsDto,
  PointsSettingsDto,
  RewardsSettingsDto,
  ShoutoutSettingsDto,
};

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
