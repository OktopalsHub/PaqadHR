import { Asset } from '../entities/asset.entity';
import { Injectable, NotFoundException } from '@nestjs/common';
import { MaintenanceStatus } from 'src/common/enums';
import { AssetMaintenanceRepository } from './asset-maintenance.repository';
import { AssetRepository } from "../repositories/asset.repository";
import { CreateMaintenanceDto } from "./dto/create-maintenance.dto";
import { UpdateMaintenanceDto } from "./dto/update-maintenance.dto";

@Injectable()
export class AssetMaintenanceService {
  constructor(
    private readonly assetMaintenanceRepository: AssetMaintenanceRepository,
    private readonly assetRepository: AssetRepository,
  ) {}
  async createMaintenance(
    tenantId: string,
    assetId: string,
    scheduledById: string,
    dto: CreateMaintenanceDto,
  ) {
    const asset = await this.assetRepository.findById(assetId, false, {
      tenantId,
    });
    if (!asset) {
      throw new NotFoundException('Asset not found');
    }
    return this.assetMaintenanceRepository.create({
      ...dto,
      assetId,
      scheduledById,
      maintenanceDate: new Date(dto.maintenanceDate),
      nextMaintenanceDate: dto.nextMaintenanceDate
        ? new Date(dto.nextMaintenanceDate)
        : undefined,
    });
  }
  async listMaintenanceByTenant(tenantId: string) {
    return this.assetMaintenanceRepository.findByTenant(tenantId);
  }
  async getMaintenance(tenantId: string, maintenanceId: string) {
    const maintenance = await this.assetMaintenanceRepository.findById(
      maintenanceId,
      false,
      {
        asset: { tenantId },
      },
      ['asset', 'scheduledBy', 'completedBy'],
    );
    if (!maintenance) {
      throw new NotFoundException('Maintenance record not found');
    }
    return maintenance;
  }
  async updateMaintenance(
    tenantId: string,
    maintenanceId: string,
    dto: UpdateMaintenanceDto,
  ) {
    const existing = await this.getMaintenance(tenantId, maintenanceId);
    const updateData = {
      ...dto,
      maintenanceDate: dto.maintenanceDate
        ? new Date(dto.maintenanceDate)
        : undefined,
      nextMaintenanceDate: dto.nextMaintenanceDate
        ? new Date(dto.nextMaintenanceDate)
        : undefined,
      completionDate: dto.completionDate
        ? new Date(dto.completionDate)
        : undefined,
    };
    return this.assetMaintenanceRepository.update(existing.id, updateData);
  }
  async deleteMaintenance(tenantId: string, maintenanceId: string) {
    const existing = await this.getMaintenance(tenantId, maintenanceId);
    return this.assetMaintenanceRepository.softDelete(existing.id);
  }
  async completeMaintenance(
    tenantId: string,
    maintenanceId: string,
    completedById: string,
    notes?: string,
  ) {
    const maintenance = await this.getMaintenance(tenantId, maintenanceId);
    return this.assetMaintenanceRepository.update(maintenance.id, {
      status: MaintenanceStatus.COMPLETED,
      completedById,
      completionDate: new Date(),
      notes,
    });
  }
  async getMaintenanceByAsset(assetId: string) {
    return this.assetMaintenanceRepository.findByAsset(assetId);
  }
  async getScheduledMaintenance(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ) {
    return this.assetMaintenanceRepository.findScheduledMaintenance(
      tenantId,
      startDate,
      endDate,
    );
  }
  async getUpcomingMaintenance(tenantId: string, days: number = 30) {
    return this.assetMaintenanceRepository.findUpcomingMaintenance(
      tenantId,
      days,
    );
  }
  async getOverdueMaintenance(tenantId: string) {
    return this.assetMaintenanceRepository.findOverdueMaintenance(tenantId);
  }
  async getMaintenanceCosts(tenantId: string, startDate: Date, endDate: Date) {
    return this.assetMaintenanceRepository.getMaintenanceCostsByPeriod(
      tenantId,
      startDate,
      endDate,
    );
  }
  async getMaintenanceByType(
    tenantId: string,
    type: string,
    startDate?: Date,
    endDate?: Date,
  ) {
    return this.assetMaintenanceRepository.findMaintenanceByType(
      tenantId,
      type,
      startDate,
      endDate,
    );
  }
}
