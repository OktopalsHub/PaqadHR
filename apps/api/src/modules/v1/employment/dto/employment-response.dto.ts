import { ApiProperty } from '@nestjs/swagger';
import { EmploymentStatus, PaySchedule, PayType } from 'src/common/enums';

import type { Employment } from '../entities/employment.entity';

export class EmploymentPositionDto {
  @ApiProperty()
  id: string;
  @ApiProperty()
  title: string;
  @ApiProperty({ required: false })
  color?: string;
}
export class EmploymentResponseDto {
  @ApiProperty()
  id: string;
  @ApiProperty()
  tenantMemberId: string;
  @ApiProperty()
  tenantId: string;
  @ApiProperty()
  startDate: Date;
  @ApiProperty({ required: false })
  endDate?: Date;
  @ApiProperty({ enum: EmploymentStatus })
  status: EmploymentStatus;
  @ApiProperty({ required: false })
  positionId?: string | null;
  @ApiProperty({ required: false })
  reportsToId?: string;
  @ApiProperty({ enum: PayType })
  payType: PayType;
  @ApiProperty({ enum: PaySchedule })
  paySchedule: PaySchedule;
  @ApiProperty()
  payRate: number;
  @ApiProperty({ required: false })
  currency?: string;
  @ApiProperty({ required: false })
  comments?: string;
  @ApiProperty({ required: false, type: EmploymentPositionDto })
  position?: EmploymentPositionDto;
  @ApiProperty()
  createdAt: Date;
  @ApiProperty()
  updatedAt: Date;
}

export class EmploymentMapper {
  static toResponse(employment: Employment): EmploymentResponseDto {
    return {
      id: employment.id,
      tenantMemberId: employment.tenantMemberId,
      tenantId: employment.tenantId,
      startDate: employment.startDate,
      endDate: employment.endDate,
      status: employment.status,
      positionId: employment.positionId,
      reportsToId: employment.reportsToId,
      payType: employment.payType,
      paySchedule: employment.paySchedule,
      payRate: employment.payRate,
      currency: employment.currency,
      comments: employment.comments,
      position: employment.position
        ? {
            id: employment.position.id,
            title: employment.position.title,
            color: employment.position.color,
          }
        : undefined,
      createdAt: employment.createdAt,
      updatedAt: employment.updatedAt,
    };
  }
  static toResponseList(employments: Employment[]): EmploymentResponseDto[] {
    return employments.map((employment) => EmploymentMapper.toResponse(employment));
  }
}
