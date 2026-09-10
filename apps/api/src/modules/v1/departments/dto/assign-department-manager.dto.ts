import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AssignDepartmentManagerDto {
  @ApiProperty({ description: 'Tenant member who will manage this department' })
  @IsUUID('4')
  managerId: string;
}
