import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { NotificationChannel } from 'src/common/enums/notification-channel.enum';
import { NotificationPreferenceType } from 'src/common/enums/notification-preference-type.enum';

export class UpdatePreferenceDto {
  @IsOptional()
  @IsEnum(NotificationChannel)
  preferredChannel?: NotificationChannel;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  inAppEnabled?: boolean;

  @IsOptional()
  @IsString()
  quietHoursStart?: string;

  @IsOptional()
  @IsString()
  quietHoursEnd?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  quietDays?: string[];
}

export class PreferenceItemDto extends UpdatePreferenceDto {
  @IsEnum(NotificationPreferenceType)
  notificationType: NotificationPreferenceType;
}

export class UpdatePreferencesDto {
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => PreferenceItemDto)
  preferences: PreferenceItemDto[];
}
