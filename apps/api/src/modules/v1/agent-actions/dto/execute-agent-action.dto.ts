import { ApiProperty } from '@nestjs/swagger';
import { AGENT_ACTIONS } from '@paqadhr/contracts';
import { IsIn, IsNotEmpty, IsObject, IsString } from 'class-validator';

export class ExecuteAgentActionDto {
  @ApiProperty({ enum: AGENT_ACTIONS })
  @IsString()
  @IsNotEmpty()
  @IsIn(AGENT_ACTIONS)
  action: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  @IsObject()
  params: Record<string, unknown>;
}
