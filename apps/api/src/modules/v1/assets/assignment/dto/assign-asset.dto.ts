import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';
export class AssignAssetDto {
  @ApiProperty({
    description: 'assigned to id',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  assignedToId: string;
  @IsOptional()
  @ApiProperty({
    description: 'expected return date',
    required: false,
    example: '2023-12-01T10:00:00Z',
  })
  @IsDateString()
  expectedReturnDate?: string;
  @IsOptional()
  @ApiProperty({
    description: 'assignment notes',
    required: false,
  })
  @IsString()
  assignmentNotes?: string;
}
