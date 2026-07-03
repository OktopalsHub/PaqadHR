import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import { NotificationChannel } from '../../../../common/enums/notification-channel.enum';
import { NotificationPriority } from '../../../../common/enums/notification-priority.enum';
import { NotificationType } from '../../../../common/enums/notification-type.enum';

export class CreateNotificationDto {
  @ApiProperty({ enum: NotificationType })
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase() : value))
  @IsEnum(NotificationType)
  type: NotificationType;
  @ApiProperty({ enum: NotificationChannel })
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase() : value))
  @IsEnum(NotificationChannel)
  channel: NotificationChannel;
  @ApiPropertyOptional({ enum: NotificationPriority })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase() : value))
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority;
  @ApiProperty()
  @IsString()
  title: string;
  @ApiProperty()
  @IsString()
  message: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  actionData?: {
    url?: string;
    buttonText?: string;
    actionType?: string;
  };
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  tenantId?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  recipientId?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  emailTemplate?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  emailContext?: Record<string, unknown>;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  emailSubject?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiresAt?: Date;
}
export class CreateBulkNotificationDto {
  @ApiProperty({ type: [String] })
  @IsUUID(4, { each: true })
  recipientIds: string[];
  @ApiProperty({ enum: NotificationChannel })
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase() : value))
  @IsEnum(NotificationChannel)
  channel: NotificationChannel;
  @ApiPropertyOptional({ enum: NotificationPriority })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase() : value))
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority;
  @ApiProperty()
  @IsString()
  title: string;
  @ApiProperty()
  @IsString()
  message: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  actionData?: {
    url?: string;
    buttonText?: string;
    actionType?: string;
  };
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  tenantId?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  emailTemplate?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  emailContext?: Record<string, unknown>;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  emailSubject?: string;
}
