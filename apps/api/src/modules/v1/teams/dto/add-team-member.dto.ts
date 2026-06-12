import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
export class AddTeamMemberDto {
  @IsUUID()
  @ApiProperty({
    description: 'member id',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty()
  memberId: string;
  @IsString()
  @ApiProperty({
    description: 'role',
    required: false,
  })
  @IsOptional()
  role?: string;
}
