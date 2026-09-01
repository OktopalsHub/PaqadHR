import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
export class UpdateLeaveDto {
  @IsOptional()
  @IsUUID()
  @ApiProperty({
    description: 'leave type id',
    required: false,
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  leaveTypeId?: string;
  @IsOptional()
  @ApiProperty({
    description: 'start date',
    required: false,
    example: '2023-12-01T10:00:00Z',
  })
  @IsDateString()
  startDate?: Date;
  @IsOptional()
  @ApiProperty({
    description: 'end date',
    required: false,
    example: '2023-12-01T10:00:00Z',
  })
  @IsDateString()
  endDate?: Date;
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
  @ApiProperty({
    description: 'attachments',
    required: false,
  })
  @IsOptional()
  attachments?: string[];
}
