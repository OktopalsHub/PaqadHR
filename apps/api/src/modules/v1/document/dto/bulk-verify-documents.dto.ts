import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsBoolean, IsUUID } from 'class-validator';

import { MAX_BULK_DOCUMENTS } from './document-bulk.constants';

export class BulkVerifyDocumentsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(MAX_BULK_DOCUMENTS)
  @IsUUID('all', { each: true })
  @ApiProperty({ type: [String] })
  documentIds: string[];
  @IsBoolean()
  @ApiProperty()
  isVerified: boolean;
}
