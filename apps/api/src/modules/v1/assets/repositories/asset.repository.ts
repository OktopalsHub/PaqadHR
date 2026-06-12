import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AssetAssignmentStatus } from 'src/common/enums';
import { Repository } from 'typeorm';
import { Asset } from "../entities/asset.entity";
import { QueryAssetsDto } from "../dto/query-assets.dto";

@Injectable()
export class AssetRepository extends Repository<Asset> {
  constructor(
    @InjectRepository(Asset)
    private readonly assetRepository: Repository<Asset>,
  ) {
    super(assetRepository.target, assetRepository.manager, assetRepository.queryRunner);
  }

  async findById(
    id: string,
    includeDeleted = false,
    additionalWhere?: Record<string, unknown>,
    relations?: string[],
  ): Promise<Asset | null> {
    return this.findOne({
      where: { id, ...additionalWhere },
      withDeleted: includeDeleted,
      relations,
    });
  }

  async findByTenant(
    tenantId: string,
    query: QueryAssetsDto,
    includeDeleted = false,
  ): Promise<{ assets: Asset[]; total: number }> {
    const { page = 1, limit = 10, search, assignedToId, ...filters } = query;
    const skip = (page - 1) * limit;
    let queryBuilder = this.assetRepository
      .createQueryBuilder('asset')
      .leftJoinAndSelect('asset.category', 'category')
      .leftJoinAndSelect('asset.assignments', 'assignments')
      .leftJoinAndSelect('assignments.assignedTo', 'assignedTo')
      .where('asset.tenantId = :tenantId', { tenantId })
      .andWhere(includeDeleted ? 'asset.deletedAt IS NULL' : '1=1');
    Object.keys(filters).forEach((key) => {
      if (filters[key] !== undefined) {
        queryBuilder = queryBuilder.andWhere(`asset.${key} = :${key}`, {
          [key]: filters[key],
        });
      }
    });
    if (assignedToId) {
      queryBuilder = queryBuilder.andWhere(
        'assignments.assignedToId = :assignedToId AND assignments.status = :status',
        { assignedToId, status: AssetAssignmentStatus.ACTIVE },
      );
    }
    if (search) {
      queryBuilder = queryBuilder.andWhere('asset.name LIKE :search', {
        search: `%${search}%`,
      });
    }
    queryBuilder = queryBuilder
      .orderBy('asset.createdAt', 'DESC')
      .skip(skip)
      .take(limit);
    const [assets, total] = await queryBuilder.getManyAndCount();
    return { assets, total };
  }
  async findAssignedAssets(
    tenantId: string,
    memberId: string,
  ): Promise<Asset[]> {
    return this.assetRepository.find({
      where: {
        tenantId,
        assignments: {
          assignedToId: memberId,
          status: AssetAssignmentStatus.ACTIVE,
        },
      },
      relations: ['category', 'assignments'],
    });
  }
  async findAssetsNeedingMaintenance(tenantId: string): Promise<Asset[]> {
    const currentDate = new Date();
    return this.assetRepository
      .createQueryBuilder('asset')
      .leftJoinAndSelect('asset.category', 'category')
      .leftJoinAndSelect('asset.maintenanceHistory', 'maintenance')
      .where('asset.tenantId = :tenantId', { tenantId })
      .andWhere(
        '(maintenance.nextMaintenanceDate <= :currentDate OR maintenance.nextMaintenanceDate IS NULL)',
        { currentDate },
      )
      .getMany();
  }
  async getAssetsByCategory(
    tenantId: string,
    categoryId: string,
  ): Promise<Asset[]> {
    return this.find({ withDeleted: false, where: {
                tenantId,
                categoryId,
              }, relations: ['category'] });
  }
}
