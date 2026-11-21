import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { AttendanceStatus } from 'src/common/enums';

export class ManualAttendanceDto {
  @ApiProperty()
  @IsUUID()
  tenantMemberId: string;

  @ApiProperty()
  @IsDateString()
  date: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  clockIn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  clockOut?: string;

  @ApiProperty({ enum: AttendanceStatus })
  @IsEnum(AttendanceStatus)
  status: AttendanceStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class BulkAttendanceRecordDto {
  @ApiProperty()
  @IsUUID()
  memberId: string;

  @ApiProperty()
  @IsDateString()
  date: string;

  @ApiProperty({ enum: AttendanceStatus })
  @IsEnum(AttendanceStatus)
  status: AttendanceStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class BulkCreateAttendanceDto {
  @ApiProperty({ type: [BulkAttendanceRecordDto] })
  @ValidateNested({ each: true })
  @Type(() => BulkAttendanceRecordDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  records: BulkAttendanceRecordDto[];
}
