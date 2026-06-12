import {
  IsNotEmpty,
  IsString,
  IsArray,
  IsUUID,
  IsOptional,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
export class BulkActionDto {
  @ApiProperty({
    description: 'Action to perform',
    enum: ['update_status', 'send_email', 'schedule_interview'],
  })
  @IsNotEmpty()
  @IsString()
  action: string;
  @ApiProperty({ description: 'Array of candidate IDs' })
  @IsArray()
  @IsUUID('4', { each: true })
  candidateIds: string[];
  @ApiProperty({ description: 'Data for the action', required: false })
  @IsOptional()
  data?: unknown;
}
