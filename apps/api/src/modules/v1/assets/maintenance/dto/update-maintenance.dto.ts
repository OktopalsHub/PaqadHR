import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { MaintenanceStatus } from 'src/common/enums';
import { CreateMaintenanceDto } from './create-maintenance.dto';

export class UpdateMaintenanceDto extends PartialType(CreateMaintenanceDto) {
  @IsOptional()
  @ApiProperty({
    description: 'status',
    required: false,
    enum: MaintenanceStatus,
  })
  @IsEnum(MaintenanceStatus)
  status?: MaintenanceStatus;
  @IsOptional()
  @ApiProperty({
    description: 'completion date',
    required: false,
    example: '2023-12-01T10:00:00Z',
  })
  @IsDateString()
  completionDate?: string;
}
