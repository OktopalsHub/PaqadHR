import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
export class CreateLeaveDto {
  @ApiProperty({
    description: 'leave type id',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  leaveTypeId: string;
  @IsDateString()
  @ApiProperty({
    description: 'start date',
    example: '2023-12-01T10:00:00Z',
  })
  @IsNotEmpty()
  startDate: Date;
  @IsDateString()
  @ApiProperty({
    description: 'end date',
    example: '2023-12-01T10:00:00Z',
  })
  @IsNotEmpty()
  endDate: Date;
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  reason: string;
  @ApiProperty({
    description: 'attachments',
    required: false,
  })
  @IsOptional()
  attachments?: string[];
}
