import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { CreateTenantMemberDto } from './index';

export class UpdateTenantMemberDto extends PartialType(CreateTenantMemberDto) {
  @IsUUID()
  @ApiProperty({
    description: 'department id',
    required: false,
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  departmentId?: string;
  @IsUUID()
  @ApiProperty({
    description: 'reports to id',
    required: false,
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  reportsToId?: string;
}
