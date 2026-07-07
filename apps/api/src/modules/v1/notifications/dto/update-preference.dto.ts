import { IsArray, IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { NotificationChannel } from 'src/common/enums/notification-channel.enum';

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
