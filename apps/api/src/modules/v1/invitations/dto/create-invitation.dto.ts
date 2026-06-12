import { Department } from '../../departments/entities/department.entity';
import { Employment } from '../../employment/entities/employment.entity';
import { Position } from '../../position/entities/position.entity';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
export class CreateInvitationDto {
  @ApiProperty({ description: 'First name of the invitee', example: 'John' })
  @IsString()
  @ApiProperty({
    description: 'first name',
    example: 'John',
  })
  @IsNotEmpty()
  firstName: string;
  @ApiProperty({ description: 'Last name of the invitee', example: 'Doe' })
  @IsString()
  @ApiProperty({
    description: 'last name',
    example: 'Doe',
  })
  @IsNotEmpty()
  lastName: string;
  @ApiProperty({ description: 'Middle name of the invitee', example: 'A.' })
  @IsString()
  @ApiProperty({
    description: 'middle name',
    required: false,
    example: 'Example Name',
  })
  @IsOptional()
  middleName?: string;
  @ApiProperty({
    description: 'Job title of the invitee',
    example: 'Frontend Engineer',
  })
  @IsString()
  @ApiProperty({
    description: 'job title',
    required: false,
  })
  @IsOptional()
  jobTitle?: string;
  @ApiProperty({
    description: 'Department ID of the invitee',
    example: 'uuid',
  })
  @IsString()
  @ApiProperty({
    description: 'department id',
    required: false,
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  departmentId?: string;
  @ApiProperty({ description: 'Employment type', example: 'Full-time' })
  @IsString()
  @ApiProperty({
    description: 'employment type',
    required: false,
  })
  @IsOptional()
  employmentType?: string;
  @ApiProperty({ description: 'Employee number', example: '0042' })
  @IsString()
  @ApiProperty({
    description: 'employee number',
    required: false,
  })
  @IsOptional()
  employeeNumber?: string;
  @ApiProperty({
    description: 'Email address of the invitee',
    example: 'john.doe@example.com',
  })
  @IsString()
  @ApiProperty({
    description: 'email',
    example: 'user@example.com',
    format: 'email',
  })
  @IsNotEmpty()
  email: string;
  @ApiProperty({ description: 'Role', example: 'Employee' })
  @IsString()
  @ApiProperty({
    description: 'role',
  })
  @IsNotEmpty()
  role: string;
  @ApiProperty({ description: 'Position ID', example: 'uuid' })
  @IsString()
  @ApiProperty({
    description: 'position id',
    required: false,
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  positionId?: string;
}
