import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

import { UpdateCandidateDto } from './update-candidate.dto';

export class UpdatePublicApplicationDto extends UpdateCandidateDto {
  @ApiProperty({ example: 'applicant@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
