import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AssetCategory } from './entities/asset-category.entity';

@Injectable()
export class AssetCategoryRepository extends Repository<AssetCategory> {
  constructor(
    @InjectRepository(AssetCategory) readonly categoryRepository: Repository<AssetCategory>,
  ) {
    super(categoryRepository.target, categoryRepository.manager, categoryRepository.queryRunner);
  }

  async findById(
    id: string,
    includeDeleted = false,
    additionalWhere?: Record<string, unknown>,
    relations?: string[],
  ) {
    return this.findOne({
      where: { id, ...additionalWhere },
      withDeleted: includeDeleted,
      relations,
    });
  }

  async findByTenant(tenantId: string, includeDeleted = false): Promise<AssetCategory[]> {
    return this.find({
      withDeleted: includeDeleted,
      where: {
        tenantId,
        isActive: true,
      },
      relations: ['assets'],
    });
  }
  async findActiveByTenant(tenantId: string): Promise<AssetCategory[]> {
    return this.find({
      withDeleted: false,
      where: {
        tenantId,
        isActive: true,
      },
    });
  }
}
