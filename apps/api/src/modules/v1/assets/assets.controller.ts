import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards } from '@nestjs/common';
import { CurrentTenantMember } from 'src/common/decorators';
import { TenantMemberGuard } from '../tenant-members/guards/tenant-members.guards';
import { AssetService } from './assets.service';
import { MemberContext } from 'src/common/interfaces';
import { CreateAssetDto } from "./dto/create-asset.dto";
import { QueryAssetsDto } from "./dto/query-assets.dto";
import { UpdateAssetDto } from "./dto/update-asset.dto";
import { AssignAssetDto } from "./assignment/dto/assign-asset.dto";
import { ReturnAssetDto } from "./dto/return-asset.dto";

@Controller('tenants/:tenantId/assets')
@UseGuards(TenantMemberGuard)
export class AssetController {
  constructor(private readonly assetService: AssetService) {}
  @Post()
  async createAsset(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateAssetDto,
    @CurrentTenantMember() member: MemberContext
    ) {
    return this.assetService.createAsset(tenantId, member.id, dto);
  }
  @Get()
  async listAssets(
    @Param('tenantId') tenantId: string,
    @Query() query: QueryAssetsDto,
  ) {
    return this.assetService.listAssetsByTenant(tenantId, query);
  }
  @Get('assigned/me')
  async getMyAssignedAssets(
    @Param('tenantId') tenantId: string,
    @CurrentTenantMember() member: MemberContext
    ) {
    return this.assetService.getAssignedAssets(tenantId, member.id);
  }
  @Get('maintenance-needed')
  async getAssetsNeedingMaintenance(@Param('tenantId') tenantId: string) {
    return this.assetService.getAssetsNeedingMaintenance(tenantId);
  }
  @Get('category/:categoryId')
  async getAssetsByCategory(
    @Param('tenantId') tenantId: string,
    @Param('categoryId') categoryId: string,
  ) {
    return this.assetService.getAssetsByCategory(tenantId, categoryId);
  }
  @Get(':assetId')
  async getAsset(
    @Param('tenantId') tenantId: string,
    @Param('assetId') assetId: string,
  ) {
    return this.assetService.getAsset(tenantId, assetId);
  }
  @Patch(':assetId')
  async updateAsset(
    @Param('tenantId') tenantId: string,
    @Param('assetId') assetId: string,
    @Body() dto: UpdateAssetDto,
  ) {
    return this.assetService.updateAsset(tenantId, assetId, dto);
  }
  @Delete(':assetId')
  async deleteAsset(
    @Param('tenantId') tenantId: string,
    @Param('assetId') assetId: string,
  ) {
    return this.assetService.deleteAsset(tenantId, assetId);
  }
  @Post(':assetId/assign')
  async assignAsset(
    @Param('tenantId') tenantId: string,
    @Param('assetId') assetId: string,
    @Body() dto: AssignAssetDto,
    @CurrentTenantMember() member: MemberContext
    ) {
    return this.assetService.assignAsset(tenantId, assetId, member.id, dto);
  }
  @Post(':assetId/return')
  async returnAsset(
    @Param('tenantId') tenantId: string,
    @Param('assetId') assetId: string,
    @Body() dto: ReturnAssetDto,
    @CurrentTenantMember() member: MemberContext
    ) {
    return this.assetService.returnAsset(tenantId, assetId, member.id, dto);
  }
}
