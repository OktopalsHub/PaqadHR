import { ApiProperty } from '@nestjs/swagger';
import { ShoutoutPointTransactionType } from 'src/common/enums/shoutout-point-transaction-type.enum';

export class MemberPointsBalanceDto {
  @ApiProperty({ format: 'uuid' })
  memberId: string;

  @ApiProperty()
  currentBalance: number;

  @ApiProperty()
  totalEarned: number;

  @ApiProperty()
  totalGiven: number;

  @ApiProperty()
  monthlyGiven: number;

  @ApiProperty()
  monthlyReceived: number;

  @ApiProperty()
  monthlyAllowance: number;

  @ApiProperty()
  remainingAllowance: number;

  @ApiProperty()
  lastResetDate: Date;
}

export class ShoutoutPointTransactionDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  tenantId: string;

  @ApiProperty({ format: 'uuid' })
  memberId: string;

  @ApiProperty({ enum: ShoutoutPointTransactionType })
  type: ShoutoutPointTransactionType;

  @ApiProperty()
  points: number;

  @ApiProperty()
  runningBalance: number;

  @ApiProperty({ format: 'uuid', required: false, nullable: true })
  shoutoutId: string | null;

  @ApiProperty({ required: false, nullable: true })
  description: string | null;

  @ApiProperty({ format: 'uuid' })
  createdBy: string;

  @ApiProperty()
  createdAt: Date;
}

export class MemberPointsTransactionPaginatedResponseDto {
  @ApiProperty({ type: () => [ShoutoutPointTransactionDto] })
  data: ShoutoutPointTransactionDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}
