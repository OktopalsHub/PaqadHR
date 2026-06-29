import { ApiProperty } from '@nestjs/swagger';
export class DepartmentMemberDto {
  @ApiProperty({ description: 'Member ID' })
  id: string;
  @ApiProperty({ description: 'First name' })
  firstName: string;
  @ApiProperty({ description: 'Last name' })
  lastName: string;
  @ApiProperty({ description: 'Email address' })
  email: string;
  @ApiProperty({ description: 'Phone number', required: false })
  phone?: string;
  @ApiProperty({ description: 'Position title', required: false })
  position?: string;
  @ApiProperty({ description: 'Role in department', required: false })
  role?: string;
  @ApiProperty({
    description: 'Whether this member is the department manager',
    required: false,
  })
  isManager?: boolean;
}
export class TeamMemberDto {
  @ApiProperty({ description: 'Member ID' })
  id: string;
  @ApiProperty({ description: 'First name', required: false })
  firstName?: string | null;
  @ApiProperty({ description: 'Last name', required: false })
  lastName?: string | null;
  @ApiProperty({ description: 'Email address', required: false })
  email?: string;
  @ApiProperty({ description: 'Role in team', required: false })
  role?: string;
}
export class TeamDto {
  @ApiProperty({ description: 'Team ID' })
  id: string;
  @ApiProperty({ description: 'Team name' })
  name: string;
  @ApiProperty({ description: 'Team description', required: false })
  description?: string;
  @ApiProperty({
    description: 'Team lead',
    type: TeamMemberDto,
    required: false,
  })
  lead?: TeamMemberDto | null;
  @ApiProperty({ description: 'Team members', type: [TeamMemberDto] })
  members: TeamMemberDto[];
  @ApiProperty({ description: 'Total number of team members' })
  memberCount: number;
}
export class DepartmentResponseDto {
  @ApiProperty({ description: 'Department ID' })
  id: string;
  @ApiProperty({ description: 'Department name' })
  name: string;
  @ApiProperty({ description: 'Department description', required: false })
  description?: string;
  @ApiProperty({ description: 'Total number of members including manager' })
  memberCount: number;
  @ApiProperty({
    description: 'Department manager',
    type: DepartmentMemberDto,
    required: false,
  })
  manager?: DepartmentMemberDto | null;
  @ApiProperty({
    description: 'Department members (excluding manager)',
    type: [DepartmentMemberDto],
  })
  members: DepartmentMemberDto[];
  @ApiProperty({ description: 'Department teams', type: [TeamDto] })
  teams: TeamDto[];
  @ApiProperty({ description: 'Creation date' })
  createdAt: Date;
  @ApiProperty({ description: 'Last update date' })
  updatedAt: Date;
  @ApiProperty({ description: 'Color code', required: false })
  color?: string;
}
