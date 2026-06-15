import { ApiProperty } from '@nestjs/swagger';
export class NewHiresResponseDto {
  @ApiProperty({ description: 'Member ID' })
  id: string;
  @ApiProperty({ description: 'First name' })
  firstName: string;
  @ApiProperty({ description: 'Last name' })
  lastName: string;
  @ApiProperty({ description: 'Preferred name', required: false })
  preferredName?: string;
  @ApiProperty({ description: 'Employee number', required: false })
  employeeNumber?: string;
  @ApiProperty({ description: 'Join date' })
  joinDate: Date;
  @ApiProperty({ description: 'Avatar URL', required: false })
  avatarUrl?: string;
  @ApiProperty({ description: 'Position title', required: false })
  positionTitle?: string;
  @ApiProperty({ description: 'Department name', required: false })
  departmentName?: string;
}
