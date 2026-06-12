import { Injectable } from '@nestjs/common';
import { CreateAssetAssignmentDto } from "./dto/create-asset-assignment.dto";
import { UpdateAssetAssignmentDto } from "./dto/update-asset-assignment.dto";

@Injectable()
export class AssetAssignmentService {
  createAssetAssignment(createAssetAssignmentDto: CreateAssetAssignmentDto) {
    return 'This action adds a new assetAssignment';
  }
  listAssetAssignments() {
    return `This action returns all assetAssignment`;
  }
  getAssetAssignment(id: number) {
    return `This action returns a #${id} assetAssignment`;
  }
  updateAssetAssignment(
    id: number,
    updateAssetAssignmentDto: UpdateAssetAssignmentDto,
  ) {
    return `This action updates a #${id} assetAssignment`;
  }
  deleteAssetAssignment(id: number) {
    return `This action removes a #${id} assetAssignment`;
  }
}
