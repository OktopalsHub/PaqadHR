import { ApiProperty } from '@nestjs/swagger';

export class ShoutoutMemberDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ required: false, nullable: true })
  firstName: string | null;

  @ApiProperty({ required: false, nullable: true })
  lastName: string | null;

  @ApiProperty({ required: false, nullable: true })
  preferredName: string | null;
}

export class ShoutoutRecipientDto extends ShoutoutMemberDto {
  @ApiProperty()
  points: number;
}

export class ShoutoutCategoryAssignmentDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ required: false, nullable: true })
  name: string | null;

  @ApiProperty({ required: false, nullable: true })
  color: string | null;
}

export class ShoutoutResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  tenantId: string;

  @ApiProperty()
  message: string;

  @ApiProperty()
  totalPoints: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ type: () => ShoutoutMemberDto })
  sender: ShoutoutMemberDto;

  @ApiProperty({ type: () => [ShoutoutRecipientDto] })
  recipients: ShoutoutRecipientDto[];

  @ApiProperty({ type: () => [ShoutoutCategoryAssignmentDto] })
  categories: ShoutoutCategoryAssignmentDto[];
}

export class ShoutoutPaginatedResponseDto {
  @ApiProperty({ type: () => [ShoutoutResponseDto] })
  data: ShoutoutResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}
