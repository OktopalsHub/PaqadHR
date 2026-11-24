import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AssignTeamLeaderDto {
  @ApiProperty()
  @IsUUID()
  memberId: string;
}
