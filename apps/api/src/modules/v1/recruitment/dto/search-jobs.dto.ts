import { Department } from '../../departments/entities/department.entity';
import { IsOptional, IsString, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
export class SearchJobsDto {
  @ApiProperty({
    description: 'Search term for job title or description',
    required: false,
  })
  @IsOptional()
  @IsString()
  search?: string;
  @ApiProperty({ description: 'Job location filter', required: false })
  @IsOptional()
  @IsString()
  location?: string;
  @ApiProperty({ description: 'Department ID filter', required: false })
  @IsOptional()
  @IsString()
  departmentId?: string;
  @ApiProperty({
    description: 'Job type filter',
    required: false,
    enum: ['full-time', 'part-time', 'contract', 'internship'],
  })
  @IsOptional()
  @IsString()
  type?: string;
  @ApiProperty({
    description: 'Experience level filter',
    required: false,
    enum: ['entry', 'junior', 'mid', 'senior', 'lead', 'executive'],
  })
  @IsOptional()
  @IsString()
  experience?: string;
  @ApiProperty({
    description: 'Page number for pagination',
    required: false,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;
  @ApiProperty({
    description: 'Number of jobs per page',
    required: false,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}
