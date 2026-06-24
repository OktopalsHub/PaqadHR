import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsUUID } from 'class-validator';

export class AssignPositionDto {
  @ApiProperty()
  @IsUUID('4')
  positionId: string;

  @IsDate()
  @Type(() => Date)
  @ApiProperty({
    description: 'When the position change takes effect',
    required: false,
    example: '2026-01-01T00:00:00.000Z',
  })
  @IsOptional()
  assignedAt?: Date;
}
