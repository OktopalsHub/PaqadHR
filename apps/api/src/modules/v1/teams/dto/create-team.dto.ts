import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
export class CreateTeamDto {
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
    description: 'lead id',
    required: false,
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  leadId?: string;
  @IsArray()
  @IsUUID('all', { each: true })
  @ApiProperty({
    description: 'members',
    required: false,
  })
  @IsOptional()
  members?: string[];
}
