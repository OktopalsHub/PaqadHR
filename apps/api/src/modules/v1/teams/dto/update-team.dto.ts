import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';
export class UpdateTeamDto {
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
    description: 'lead id',
    required: false,
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  leadId?: string;
}
