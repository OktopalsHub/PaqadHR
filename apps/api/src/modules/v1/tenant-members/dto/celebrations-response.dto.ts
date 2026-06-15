import { ApiProperty } from '@nestjs/swagger';
import { CelebrationType } from '../../../../common/enums/celebration-type.enum';

export class CelebrationResponseDto {
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
  @ApiProperty({ description: 'Avatar URL', required: false })
  avatarUrl?: string;
  @ApiProperty({ description: 'Position title', required: false })
  positionTitle?: string;
  @ApiProperty({ description: 'Department name', required: false })
  departmentName?: string;
  @ApiProperty({ enum: CelebrationType, description: 'Type of celebration' })
  type: CelebrationType;
  @ApiProperty({ description: 'Celebration date' })
  date: Date;
  @ApiProperty({
    description: 'Years of service (for anniversaries)',
    required: false,
  })
  years?: number;
}
