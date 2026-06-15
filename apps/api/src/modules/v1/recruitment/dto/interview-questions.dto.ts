import { ApiProperty } from '@nestjs/swagger';
export class InterviewQuestionsDto {
  @ApiProperty({ description: 'Generated interview questions', type: [String] })
  questions: string[];
}
