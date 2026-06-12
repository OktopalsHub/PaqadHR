import { ApiProperty } from '@nestjs/swagger';
import { LeaveMemberResponseDto } from "./leave-member-response.dto";

export class LeaveTypeResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() description: string;
}
export class LeaveResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() startDate: Date;
  @ApiProperty() endDate: Date;
  @ApiProperty() duration: number;
  @ApiProperty() status: string;
  @ApiProperty() reason: string;
  @ApiProperty() comments?: string;
  @ApiProperty() reviewedAt?: Date;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
  @ApiProperty({ type: () => LeaveTypeResponseDto, nullable: true })
  leaveType: LeaveTypeResponseDto | null;
  @ApiProperty({ type: () => LeaveMemberResponseDto, nullable: true })
  requester: LeaveMemberResponseDto | null;
  @ApiProperty({ type: () => LeaveMemberResponseDto, nullable: true })
  approver: LeaveMemberResponseDto | null;
}
