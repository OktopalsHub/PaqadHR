import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { JobExperienceDto } from './job-experience.dto';

export class JobQualificationsDto {
  @ApiProperty({ type: [String], description: 'Educational qualifications' })
  @IsArray()
  @IsString({ each: true })
  education: string[];
  @ApiProperty({ type: JobExperienceDto })
  @ValidateNested()
  @Type(() => JobExperienceDto)
  experience: JobExperienceDto;
  @ApiProperty({ type: [String], description: 'Required skills' })
  @IsArray()
  @IsString({ each: true })
  skills: string[];
  @ApiProperty({
    type: [String],
    description: 'Preferred qualifications',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferred?: string[];
}
