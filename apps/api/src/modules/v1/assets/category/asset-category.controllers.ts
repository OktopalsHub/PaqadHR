import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentTenantMember } from 'src/common/decorators';
import type { MemberContext } from 'src/common/interfaces';
import { TenantMemberGuard } from '../../tenant-members/guards/tenant-members.guards';
import { AssetCategoryService } from './asset-category.service';
import type { CreateAssetCategoryDto } from './dto/create-asset-category.dto';
import type { UpdateAssetCategoryDto } from './dto/update-asset-category.dto';

@Controller('tenants/:tenantId/asset-categories')
@UseGuards(TenantMemberGuard)
export class AssetCategoryController {
  constructor(private readonly assetCategoryService: AssetCategoryService) {}
  @Post()
  async createAssetCategory(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateAssetCategoryDto,
    @CurrentTenantMember() member: MemberContext,
  ) {
    return this.assetCategoryService.createAssetCategory(tenantId, member.id, dto);
  }
  @Get()
  async listCategories(
    @Param('tenantId') tenantId: string,
    @Query('includeDeleted') includeDeleted?: boolean,
  ) {
    return this.assetCategoryService.listCategoriesByTenant(tenantId, includeDeleted);
  }
  @Get('active')
  async getActiveCategories(@Param('tenantId') tenantId: string) {
    return this.assetCategoryService.getActiveCategoriesByTenant(tenantId);
  }
  @Get(':categoryId')
  async getCategory(@Param('tenantId') tenantId: string, @Param('categoryId') categoryId: string) {
    return this.assetCategoryService.getCategory(tenantId, categoryId);
  }
  @Patch(':categoryId')
  async updateAssetCategory(
    @Param('tenantId') tenantId: string,
    @Param('categoryId') categoryId: string,
    @Body() dto: UpdateAssetCategoryDto,
  ) {
    return this.assetCategoryService.updateAssetCategory(tenantId, categoryId, dto);
  }
  @Delete(':categoryId')
  async deleteAssetCategory(
    @Param('tenantId') tenantId: string,
    @Param('categoryId') categoryId: string,
  ) {
    return this.assetCategoryService.deleteAssetCategory(tenantId, categoryId);
  }
}
