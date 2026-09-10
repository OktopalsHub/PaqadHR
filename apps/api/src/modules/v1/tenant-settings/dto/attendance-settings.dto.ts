import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsNumber, IsOptional } from 'class-validator';

export class AttendanceSettingsDto {
  @ApiProperty({
    description: 'Weekend days (0=Sunday, 1=Monday, etc.)',
    example: [0, 6],
    type: [Number],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  weekends?: number[];

  @ApiProperty({
    description: 'Allow members to clock in and out from the app',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  clockInEnabled?: boolean;
}
