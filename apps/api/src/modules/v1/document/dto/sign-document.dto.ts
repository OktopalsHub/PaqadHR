import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsEmail } from 'class-validator';

import { MAX_SIGNERS } from './document-bulk.constants';

export class SignDocumentDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(MAX_SIGNERS)
  @IsEmail({}, { each: true })
  @ApiProperty({ type: [String] })
  signerEmails: string[];
}
