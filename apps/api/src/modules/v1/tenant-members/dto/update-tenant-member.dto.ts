import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { TenantMemberPermission, TenantMemberRole } from 'src/common/enums';

export class UpdateTenantMemberDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase() : value))
  @IsEnum(TenantMemberRole)
  @ApiProperty({
    description: 'workspace role',
    required: false,
  })
  @IsOptional()
  role?: TenantMemberRole;

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

  @IsArray()
  @IsEnum(TenantMemberPermission, { each: true })
  @IsOptional()
  @ApiProperty({
    description:
      'Fine-grained member permissions. Only workspace owners can grant or revoke these.',
    enum: TenantMemberPermission,
    isArray: true,
    required: false,
  })
  permissions?: TenantMemberPermission[];
}
