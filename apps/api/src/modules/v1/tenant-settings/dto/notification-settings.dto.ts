import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsUrl } from 'class-validator';

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
