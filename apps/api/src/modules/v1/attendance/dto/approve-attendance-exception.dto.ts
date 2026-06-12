import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
export class ApproveAttendanceExceptionDto {
  @IsString()
  @ApiProperty({
    description: 'comments',
    required: false,
  })
  @IsOptional()
  comments?: string;
}
