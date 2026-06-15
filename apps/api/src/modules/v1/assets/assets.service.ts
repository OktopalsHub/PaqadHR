import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AssetAssignmentStatus, AssetStatus } from 'src/common/enums';
import { AssetAssignmentRepository } from '../assets/assignment/asset-assignment.repository';
import type { AssignAssetDto } from './assignment/dto/assign-asset.dto';
import { AssetCategoryService } from './category/asset-category.service';
import type { CreateAssetDto } from './dto/create-asset.dto';
import type { QueryAssetsDto } from './dto/query-assets.dto';
import type { ReturnAssetDto } from './dto/return-asset.dto';
import type { UpdateAssetDto } from './dto/update-asset.dto';
import { AssetRepository } from './repositories/asset.repository';

@Injectable()
export class AssetService {
  constructor(
    private readonly assetRepository: AssetRepository,
    private readonly assetAssignmentRepository: AssetAssignmentRepository,
    readonly _assetCategoryService: AssetCategoryService,
  ) {}
  async createAsset(tenantId: string, memberId: string, dto: CreateAssetDto) {
    const assetData = {
      ...dto,
      tenantMemberId: memberId,
      tenantId,
      createdBy: memberId,
      building: dto.location?.building,
      floor: dto.location?.floor,
      room: dto.location?.room,
      locationNotes: dto.location?.locationNotes,
    };
    return this.assetRepository.create(assetData);
  }
  async listAssetsByTenant(tenantId: string, query: QueryAssetsDto) {
    const { assets, total } = await this.assetRepository.findByTenant(tenantId, query);
    return { assets, total };
  }
  async getAsset(tenantId: string, assetId: string) {
    const asset = await this.assetRepository.findById(
      assetId,
      false,
      {
        tenantId,
      },
      ['category', 'assignments', 'assignments.assignedTo', 'maintenanceHistory'],
    );
    if (!asset) {
      throw new NotFoundException('Asset not found');
    }
    return asset;
  }
  async updateAsset(tenantId: string, assetId: string, dto: UpdateAssetDto) {
    const existing = await this.getAsset(tenantId, assetId);
    const updateData = {
      ...dto,
      building: dto.location?.building,
      floor: dto.location?.floor,
      room: dto.location?.room,
      locationNotes: dto.location?.locationNotes,
    };
    return this.assetRepository.update(existing.id, updateData);
  }
  async deleteAsset(tenantId: string, assetId: string) {
    const existing = await this.getAsset(tenantId, assetId);
    const activeAssignment =
      await this.assetAssignmentRepository.findActiveAssignmentByAsset(assetId);
    if (activeAssignment) {
      throw new BadRequestException('Cannot delete asset that is currently assigned');
    }
    return this.assetRepository.softDelete(existing.id);
  }
  async assignAsset(tenantId: string, assetId: string, assignedById: string, dto: AssignAssetDto) {
    const asset = await this.getAsset(tenantId, assetId);
    if (asset.status !== AssetStatus.AVAILABLE) {
      throw new BadRequestException('Asset is not available for assignment');
    }
    const existingAssignment =
      await this.assetAssignmentRepository.findActiveAssignmentByAsset(assetId);
    if (existingAssignment) {
      throw new BadRequestException('Asset is already assigned');
    }
    const assignment = await this.assetAssignmentRepository.create({
      assetId,
      assignedToId: dto.assignedToId,
      assignedById,
      expectedReturnDate: dto.expectedReturnDate ? new Date(dto.expectedReturnDate) : undefined,
      assignmentNotes: dto.assignmentNotes,
    });
    await this.assetRepository.update(assetId, {
      status: AssetStatus.ASSIGNED,
    });
    return assignment;
  }
  async returnAsset(tenantId: string, assetId: string, returnedById: string, dto: ReturnAssetDto) {
    const _asset = await this.getAsset(tenantId, assetId);
    const activeAssignment =
      await this.assetAssignmentRepository.findActiveAssignmentByAsset(assetId);
    if (!activeAssignment) {
      throw new BadRequestException('Asset is not currently assigned');
    }
    await this.assetAssignmentRepository.update(activeAssignment.id, {
      status: AssetAssignmentStatus.RETURNED,
      returnDate: new Date(),
      returnedById,
      returnCondition: dto.returnCondition,
      returnNotes: dto.returnNotes,
    });
    await this.assetRepository.update(assetId, {
      status: AssetStatus.AVAILABLE,
      condition: dto.returnCondition,
    });
    return this.getAsset(tenantId, assetId);
  }
  async getAssignedAssets(tenantId: string, memberId: string) {
    return this.assetRepository.findAssignedAssets(tenantId, memberId);
  }
  async getAssetsNeedingMaintenance(tenantId: string) {
    return this.assetRepository.findAssetsNeedingMaintenance(tenantId);
  }
  async getAssetsByCategory(tenantId: string, categoryId: string) {
    return this.assetRepository.getAssetsByCategory(tenantId, categoryId);
  }
}
