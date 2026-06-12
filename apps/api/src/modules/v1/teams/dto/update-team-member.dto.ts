import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
export class UpdateTeamMemberDto {
  @IsString()
  @ApiProperty({
    description: 'role',
  })
  @IsNotEmpty()
  role: string;
}
