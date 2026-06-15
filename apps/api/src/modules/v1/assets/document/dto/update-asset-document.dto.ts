import { PartialType } from '@nestjs/swagger';
import { CreateAssetDocumentDto } from './create-asset-document.dto';

export class UpdateAssetDocumentDto extends PartialType(CreateAssetDocumentDto) {}
