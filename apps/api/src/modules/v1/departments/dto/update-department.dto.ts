import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';
export class UpdateDepartmentDto {
  @IsString()
  @ApiProperty({
    description: 'name',
    required: false,
    example: 'Example Name',
  })
  @IsOptional()
  name?: string;
  @IsString()
  @ApiProperty({
    description: 'description',
    required: false,
  })
  @IsOptional()
  description?: string;
  @IsUUID()
  @ApiProperty({
    description: 'manager id',
    required: false,
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  managerId?: string;
  @IsUUID()
  @ApiProperty({
    description: 'parent id',
    required: false,
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  parentId?: string;
  @IsUUID()
  @ApiProperty({
    description: 'created by',
    required: false,
  })
  @IsOptional()
  createdBy?: string;
}
