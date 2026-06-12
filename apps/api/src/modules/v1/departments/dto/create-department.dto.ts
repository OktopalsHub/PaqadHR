import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
export class CreateDepartmentDto {
  @IsString()
  @ApiProperty({
    description: 'name',
    example: 'Example Name',
  })
  @IsNotEmpty()
  name: string;
  @IsString()
  @ApiProperty({
    description: 'description',
    required: false,
  })
  @IsOptional()
  description?: string;
  @IsString()
  @ApiProperty({
    description: 'manager id',
    required: false,
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  managerId?: string;
  @IsString()
  @ApiProperty({
    description: 'parent id',
    required: false,
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  parentId?: string;
}
