import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PendingAgentActionListItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  action: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  createdAt: Date;

  @ApiPropertyOptional({ type: String, nullable: true })
  correlationId: string | null;

  @ApiProperty()
  actorType: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  params: Record<string, unknown>;

  @ApiPropertyOptional({ type: String, nullable: true })
  apiKeyName: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  requestedByMemberName: string | null;
}
