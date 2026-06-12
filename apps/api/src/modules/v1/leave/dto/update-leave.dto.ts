import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';
export class UpdateLeaveDto {
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
