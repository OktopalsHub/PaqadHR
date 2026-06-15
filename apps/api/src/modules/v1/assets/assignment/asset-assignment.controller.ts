import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { AssetAssignmentService } from './asset-assignment.service';
import type { CreateAssetAssignmentDto } from './dto/create-asset-assignment.dto';
import type { UpdateAssetAssignmentDto } from './dto/update-asset-assignment.dto';

@Controller('tenants/:tenantId/asset-assignment')
export class AssetAssignmentController {
  constructor(private readonly assetAssignmentService: AssetAssignmentService) {}
  @Post()
  createAssetAssignment(@Body() createAssetAssignmentDto: CreateAssetAssignmentDto) {
    return this.assetAssignmentService.createAssetAssignment(createAssetAssignmentDto);
  }
  @Get()
  listAssetAssignments() {
    return this.assetAssignmentService.listAssetAssignments();
  }
  @Get(':id')
  getAssetAssignment(@Param('id') id: string) {
    return this.assetAssignmentService.getAssetAssignment(+id);
  }
  @Patch(':id')
  updateAssetAssignment(
    @Param('id') id: string,
    @Body() updateAssetAssignmentDto: UpdateAssetAssignmentDto,
  ) {
    return this.assetAssignmentService.updateAssetAssignment(+id, updateAssetAssignmentDto);
  }
  @Delete(':id')
  deleteAssetAssignment(@Param('id') id: string) {
    return this.assetAssignmentService.deleteAssetAssignment(+id);
  }
}
