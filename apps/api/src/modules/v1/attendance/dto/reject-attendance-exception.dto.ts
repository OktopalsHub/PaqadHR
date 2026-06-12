import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
export class RejectAttendanceExceptionDto {
  @IsString()
  @ApiProperty({
    description: 'comments',
  })
  @IsNotEmpty()
  comments: string;
}
