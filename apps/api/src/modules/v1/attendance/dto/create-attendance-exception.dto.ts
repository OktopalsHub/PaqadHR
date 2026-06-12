import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { EAttendanceExceptionType } from 'src/common/enums';
export class CreateAttendanceExceptionDto {
  @IsDateString()
  @ApiProperty({
    description: 'date',
    example: '2023-12-01T10:00:00Z',
  })
  @IsNotEmpty()
  date: Date;
  @IsEnum(EAttendanceExceptionType)
  @ApiProperty({
    description: 'type',
  })
  @IsNotEmpty()
  type: EAttendanceExceptionType;
  @IsString()
  @ApiProperty({
    description: 'reason',
  })
  @IsNotEmpty()
  reason: string;
}
