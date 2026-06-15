import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsString } from 'class-validator';
export class JobSalaryDto {
  @ApiProperty({ description: 'Minimum salary' })
  @IsNumber()
  min: number;
  @ApiProperty({ description: 'Maximum salary' })
  @IsNumber()
  max: number;
  @ApiProperty({ description: 'Salary currency', example: 'USD' })
  @IsString()
  currency: string;
  @ApiProperty({ description: 'Whether salary is negotiable' })
  @IsBoolean()
  isNegotiable: boolean;
}
