import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString } from 'class-validator';
export class JobExperienceDto {
  @ApiProperty({ description: 'Years of experience required' })
  @IsNotEmpty()
  @IsNumber()
  years: number;
  @ApiProperty({ description: 'Type of experience (e.g., software, design)' })
  @IsNotEmpty()
  @IsString()
  type: string;
}
