import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsUUID } from 'class-validator';

export class MarkNotificationsReadDto {
  @ApiProperty({ type: [String], maxItems: 200 })
  @IsUUID('all', { each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  notificationIds: string[];
}
