import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

import { DOCUMENT_ACCESS_ACTIONS } from './document-bulk.constants';

export class LogDocumentAccessDto {
  @IsIn(DOCUMENT_ACCESS_ACTIONS)
  @ApiProperty({ enum: DOCUMENT_ACCESS_ACTIONS })
  action: (typeof DOCUMENT_ACCESS_ACTIONS)[number];
}
