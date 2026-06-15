import { Injectable, NotFoundException } from '@nestjs/common';
import type { AssetCategoryRepository } from './asset-category.repository';
import type { CreateAssetCategoryDto } from './dto/create-asset-category.dto';
import type { UpdateAssetCategoryDto } from './dto/update-asset-category.dto';

@Injectable()
export class AssetCategoryService {
  constructor(private readonly assetCategoryRepository: AssetCategoryRepository) {}
  async createAssetCategory(tenantId: string, memberId: string, dto: CreateAssetCategoryDto) {
    return this.assetCategoryRepository.create({
      ...dto,
      name: dto.name.toLowerCase().trim(),
      tenantMemberId: memberId,
      tenantId,
    });
  }
  async listCategoriesByTenant(tenantId: string, includeDeleted = false) {
    return this.assetCategoryRepository.findByTenant(tenantId, includeDeleted);
  }
  async getActiveCategoriesByTenant(tenantId: string) {
    return this.assetCategoryRepository.findActiveByTenant(tenantId);
  }
  async getCategory(tenantId: string, categoryId: string) {
    const category = await this.assetCategoryRepository.findById(
      categoryId,
      false,
      {
        tenantId,
      },
      ['assets'],
    );
    if (!category) {
      throw new NotFoundException('Asset category not found in this tenant');
    }
    return category;
  }
  async updateAssetCategory(tenantId: string, categoryId: string, dto: UpdateAssetCategoryDto) {
    const existing = await this.getCategory(tenantId, categoryId);
    return this.assetCategoryRepository.update(existing.id, dto);
  }
  async deleteAssetCategory(tenantId: string, categoryId: string) {
    const existing = await this.getCategory(tenantId, categoryId);
    return this.assetCategoryRepository.softDelete(existing.id);
  }
}
