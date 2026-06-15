import { PartialType } from '@nestjs/swagger';
import { CreateAssetAssignmentDto } from './create-asset-assignment.dto';

export class UpdateAssetAssignmentDto extends PartialType(CreateAssetAssignmentDto) {}
