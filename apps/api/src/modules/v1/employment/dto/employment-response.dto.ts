import { ApiProperty } from '@nestjs/swagger';
import { EmploymentStatus, PaySchedule, PayType } from 'src/common/enums';
export class EmploymentResponseDto {
  @ApiProperty()
  id: string;
  @ApiProperty()
  startDate: Date;
  @ApiProperty({ required: false })
  endDate?: Date;
  @ApiProperty({ enum: EmploymentStatus })
  status: EmploymentStatus;
  @ApiProperty()
  memberId: string;
  @ApiProperty()
  positionId: string;
  @ApiProperty()
  tenantId: string;
  @ApiProperty({ required: false })
  reportsToId?: string;
  @ApiProperty({ enum: PayType })
  payType: PayType;
  @ApiProperty({ enum: PaySchedule })
  paySchedule: PaySchedule;
  @ApiProperty()
  payRate: number;
  @ApiProperty({ required: false })
  comments?: string;
  @ApiProperty({ required: false })
  employee?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatar?: string;
  };
  @ApiProperty({ required: false })
  position?: {
    id: string;
    title: string;
    department?: {
      id: string;
      name: string;
    };
  };
  @ApiProperty({ required: false })
  reportsTo?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  @ApiProperty()
  createdAt: Date;
  @ApiProperty()
  updatedAt: Date;
}
