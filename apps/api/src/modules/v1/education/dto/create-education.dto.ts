import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DegreeType } from 'src/common/enums';
export class CreateEducationDto {
  @ApiProperty({
    description: 'Degree name',
    example: 'Bachelor of Science in Computer Science',
  })
  @IsString()
  @ApiProperty({
    description: 'title',
  })
  @IsNotEmpty()
  title: string;
  @ApiProperty({
    description: 'Type of degree',
    enum: DegreeType,
    example: DegreeType.BACHELOR,
  })
  @IsEnum(DegreeType)
  @ApiProperty({
    description: 'degree type',
  })
  @IsNotEmpty()
  degreeType: DegreeType;
  @ApiProperty({
    description: 'Institution name',
    example: 'University of Technology',
  })
  @IsString()
  @ApiProperty({
    description: 'institution',
  })
  @IsNotEmpty()
  institution: string;
  @ApiProperty({
    description: 'Field of study',
    example: 'Computer Science',
    required: false,
  })
  @IsString()
  @ApiProperty({
    description: 'field of study',
    required: false,
  })
  @IsOptional()
  fieldOfStudy?: string;
  @ApiProperty({
    description: 'Start date of education',
    example: '2018-09-01',
    required: false,
  })
  @IsDateString()
  @ApiProperty({
    description: 'start date',
    required: false,
    example: '2023-12-01T10:00:00Z',
  })
  @IsOptional()
  startDate?: string;
  @ApiProperty({
    description: 'End date of education',
    example: '2022-05-15',
    required: false,
  })
  @IsDateString()
  @ApiProperty({
    description: 'end date',
    required: false,
    example: '2023-12-01T10:00:00Z',
  })
  @IsOptional()
  endDate?: string;
  @ApiProperty({
    description: 'Description of the education',
    example: 'Focused on software engineering and web development',
    required: false,
  })
  @IsString()
  @ApiProperty({
    description: 'description',
    required: false,
  })
  @IsOptional()
  description?: string;
  @ApiProperty({
    description: 'Grade Point Average',
    example: '3.8',
    required: false,
  })
  @IsString()
  @ApiProperty({
    description: 'gpa',
    required: false,
  })
  @IsOptional()
  gpa?: string;
}
