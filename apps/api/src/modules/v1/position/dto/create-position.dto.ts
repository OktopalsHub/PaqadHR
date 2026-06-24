import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';
export class CreatePositionDto {
  @IsString()
  @ApiProperty({
    description: 'title',
  })
  @IsNotEmpty()
  title: string;
  @IsString()
  @ApiProperty({
    description: 'department',
    required: false,
  })
  @IsOptional()
  department?: string;
  @IsString()
  @ApiProperty({
    description: 'description',
    required: false,
  })
  @IsOptional()
  description?: string;
  @IsBoolean()
  @ApiProperty({
    description: 'is active',
    required: false,
    example: true,
  })
  @IsOptional()
  isActive?: boolean = true;
  @IsString()
  @ApiProperty({
    description: 'color',
    required: false,
  })
  @IsOptional()
  color?: string;
}
