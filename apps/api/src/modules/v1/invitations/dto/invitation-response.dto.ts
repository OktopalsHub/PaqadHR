import { Department } from '../../departments/entities/department.entity';
import { Employment } from '../../employment/entities/employment.entity';
import { ApiProperty } from '@nestjs/swagger';
import { InvitationStatus } from 'src/common/enums';
export class InvitationResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the invitation',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;
  @ApiProperty({
    description: 'Email address of the invited user',
    example: 'user@example.com',
  })
  email: string;
  @ApiProperty({
    description: 'ID of the tenant the user is invited to',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  tenantId: string;
  @ApiProperty({
    description: 'Name of the tenant the user is invited to',
    example: 'Acme Corporation',
  })
  tenantName: string;
  @ApiProperty({
    description: 'Role assigned to the invited user',
    example: 'MEMBER',
    enum: ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'],
  })
  role: string;
  @ApiProperty({
    description: 'Current status of the invitation',
    example: 'PENDING',
    enum: ['PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED'],
  })
  status: InvitationStatus;
  @ApiProperty({
    description: 'ID of the user who sent the invitation',
    example: '123e4567-e89b-12d3-a456-426614174002',
  })
  invitedBy: string;
  @ApiProperty({
    description: 'Date when the invitation expires',
    example: '2024-01-08T00:00:00.000Z',
  })
  expiresAt: Date;
  @ApiProperty({ description: 'First name of the invitee', example: 'John' })
  firstName: string;
  @ApiProperty({ description: 'Last name of the invitee', example: 'Doe' })
  lastName: string;
  @ApiProperty({ description: 'Middle name of the invitee', example: 'A.' })
  middleName?: string;
  @ApiProperty({
    description: 'Job title of the invitee',
    example: 'Frontend Engineer',
  })
  jobTitle?: string;
  @ApiProperty({
    description: 'Department ID of the invitee',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  departmentId?: string;
  @ApiProperty({ description: 'Employment type', example: 'Full-time' })
  employmentType?: string;
  @ApiProperty({ description: 'Join date', example: '2025-08-01' })
  joinDate?: string;
  @ApiProperty({ description: 'Employee number', example: '0042' })
  employeeNumber?: string;
  @ApiProperty({
    description: 'Unique token for the invitation link',
    example: 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef',
  })
  token: string;
}
