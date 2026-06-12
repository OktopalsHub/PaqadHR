import { Candidate } from '../entities/candidate.entity';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
export class CandidateNoteDto {
  @ApiProperty({
    description: 'Note content',
    minLength: 1,
    maxLength: 1000,
    example:
      'Candidate showed excellent problem-solving skills during the technical interview.',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(1000)
  content: string;
}
