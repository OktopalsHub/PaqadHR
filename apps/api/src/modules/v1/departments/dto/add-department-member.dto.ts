import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AddDepartmentMemberDto {
  @ApiProperty({ description: 'Tenant member to add to this department' })
  @IsUUID('4')
  memberId: string;
}
