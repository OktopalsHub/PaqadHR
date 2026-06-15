import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateAttendancePolicyDto } from './create-attendance-policy.dto';

export class UpdateAttendancePolicyDto extends PartialType(CreateAttendancePolicyDto) {
  @IsBoolean()
  @ApiProperty({
    description: 'is active',
    required: false,
    example: true,
  })
  @IsOptional()
  isActive?: boolean;
}
