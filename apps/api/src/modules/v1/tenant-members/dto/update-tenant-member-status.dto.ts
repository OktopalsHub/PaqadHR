import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';
export class UpdateTenantMemberStatusDto {
  @ApiProperty({
    description: 'Whether the tenant member should be active or inactive',
    example: true,
  })
  @ApiProperty({
    description: 'is active',
    example: true,
  })
  @IsBoolean()
  isActive: boolean;
}
