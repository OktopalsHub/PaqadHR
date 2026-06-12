import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { AttendanceStatus } from 'src/common/enums';
export class UpdateAttendanceDto {
  @IsDateString()
  @ApiProperty({
    description: 'clock in',
    required: false,
  })
  @IsOptional()
  clockIn?: Date;
  @IsDateString()
  @ApiProperty({
    description: 'clock out',
    required: false,
  })
  @IsOptional()
  clockOut?: Date;
  @IsEnum(AttendanceStatus)
  @ApiProperty({
    description: 'status',
    required: false,
  })
  @IsOptional()
  status?: AttendanceStatus;
  @IsString()
  @ApiProperty({
    description: 'notes',
    required: false,
  })
  @IsOptional()
  notes?: string;
}
