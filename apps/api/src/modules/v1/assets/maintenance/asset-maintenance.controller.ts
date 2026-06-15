import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentTenantMember } from 'src/common/decorators';
import type { MemberContext } from 'src/common/interfaces';
import { TenantMemberGuard } from '../../tenant-members/guards/tenant-members.guards';
import type { AssetMaintenanceService } from './asset-maintenance.service';
import type { CreateMaintenanceDto } from './dto/create-maintenance.dto';
import type { UpdateMaintenanceDto } from './dto/update-maintenance.dto';

@Controller('tenants/:tenantId/assets/:assetId/maintenance')
@UseGuards(TenantMemberGuard)
export class AssetMaintenanceController {
  constructor(private readonly assetMaintenanceService: AssetMaintenanceService) {}
  @Post()
  async createMaintenance(
    @Param('tenantId') tenantId: string,
    @Param('assetId') assetId: string,
    @Body() dto: CreateMaintenanceDto,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.assetMaintenanceService.createMaintenance(tenantId, assetId, member.id, dto);
  }
  @Get()
  async getMaintenanceByAsset(@Param('assetId') assetId: string) {
    return this.assetMaintenanceService.getMaintenanceByAsset(assetId);
  }
  @Get(':maintenanceId')
  async getMaintenance(
    @Param('tenantId') tenantId: string,
    @Param('maintenanceId') maintenanceId: string,
  ) {
    return this.assetMaintenanceService.getMaintenance(tenantId, maintenanceId);
  }
  @Patch(':maintenanceId')
  async updateMaintenance(
    @Param('tenantId') tenantId: string,
    @Param('maintenanceId') maintenanceId: string,
    @Body() dto: UpdateMaintenanceDto,
  ) {
    return this.assetMaintenanceService.updateMaintenance(tenantId, maintenanceId, dto);
  }
  @Delete(':maintenanceId')
  async deleteMaintenance(
    @Param('tenantId') tenantId: string,
    @Param('maintenanceId') maintenanceId: string,
  ) {
    return this.assetMaintenanceService.deleteMaintenance(tenantId, maintenanceId);
  }
  @Post(':maintenanceId/complete')
  async completeMaintenance(
    @Param('tenantId') tenantId: string,
    @Param('maintenanceId') maintenanceId: string,
    @Body('notes') notes: string,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.assetMaintenanceService.completeMaintenance(
      tenantId,
      maintenanceId,
      member.id,
      notes,
    );
  }
}
