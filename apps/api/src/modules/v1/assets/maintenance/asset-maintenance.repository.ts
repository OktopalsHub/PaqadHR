import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MaintenanceStatus } from 'src/common/enums';
import { Between, Repository } from 'typeorm';
import { AssetMaintenance } from "./entities/asset-maintenance.entity";

@Injectable()
export class AssetMaintenanceRepository extends Repository<AssetMaintenance> {
  constructor(
    @InjectRepository(AssetMaintenance)
    private readonly maintenanceRepository: Repository<AssetMaintenance>,
  ) {
    super(maintenanceRepository.target, maintenanceRepository.manager, maintenanceRepository.queryRunner);
  }

  async findById(
    id: string,
    includeDeleted = false,
    additionalWhere?: Record<string, unknown>,
    relations?: string[],
  ): Promise<AssetMaintenance | null> {
    return this.findOne({
      where: { id, ...additionalWhere },
      withDeleted: includeDeleted,
      relations,
    });
  }

  async findByAsset(assetId: string): Promise<AssetMaintenance[]> {
    return this.find({ withDeleted: false, where: { assetId }, relations: ['scheduledBy', 'completedBy'] });
  }
  async findScheduledMaintenance(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<AssetMaintenance[]> {
    return this.maintenanceRepository.find({
      where: {
        maintenanceDate: Between(startDate, endDate),
        asset: { tenantId },
        status: MaintenanceStatus.SCHEDULED,
      },
      relations: ['asset', 'scheduledBy'],
      order: { maintenanceDate: 'ASC' },
    });
  }
  async findUpcomingMaintenance(
    tenantId: string,
    days: number = 30,
  ): Promise<AssetMaintenance[]> {
    const currentDate = new Date();
    const futureDate = new Date();
    futureDate.setDate(currentDate.getDate() + days);
    return this.maintenanceRepository.find({
      where: {
        maintenanceDate: Between(currentDate, futureDate),
        asset: { tenantId },
        status: MaintenanceStatus.SCHEDULED,
      },
      relations: ['asset', 'scheduledBy'],
      order: { maintenanceDate: 'ASC' },
    });
  }
  async getMaintenanceCostsByPeriod(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{ totalCost: number; maintenanceCount: number }> {
    const result = await this.maintenanceRepository
      .createQueryBuilder('maintenance')
      .innerJoin('maintenance.asset', 'asset')
      .select('SUM(maintenance.cost)', 'totalCost')
      .addSelect('COUNT(*)', 'maintenanceCount')
      .where('asset.tenantId = :tenantId', { tenantId })
      .andWhere('maintenance.completionDate BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .andWhere('maintenance.status = :status', { status: 'COMPLETED' })
      .getRawOne();
    return {
      totalCost: parseFloat(result.totalCost) || 0,
      maintenanceCount: parseInt(result.maintenanceCount) || 0,
    };
  }
  async findOverdueMaintenance(tenantId: string): Promise<AssetMaintenance[]> {
    const currentDate = new Date();
    return this.maintenanceRepository
      .find({
        where: {
          asset: { tenantId },
          status: MaintenanceStatus.SCHEDULED,
        },
        relations: ['asset', 'scheduledBy'],
      })
      .then((maintenances) =>
        maintenances.filter(
          (maintenance) => maintenance.maintenanceDate < currentDate,
        ),
      );
  }
  async findByTenant(
    tenantId: string,
    includeDeleted = false,
  ): Promise<AssetMaintenance[]> {
    return this.maintenanceRepository.find({
      where: {
        asset: { tenantId },
      },
      relations: ['asset', 'asset.category', 'scheduledBy', 'completedBy'],
      withDeleted: includeDeleted,
      order: { maintenanceDate: 'DESC' },
    });
  }
  async findMaintenanceByType(
    tenantId: string,
    type: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<AssetMaintenance[]> {
    const whereConditions: Record<string, unknown> = {
      asset: { tenantId },
      type,
    };
    if (startDate && endDate) {
      whereConditions.maintenanceDate = Between(startDate, endDate);
    }
    return this.maintenanceRepository.find({
      where: whereConditions,
      relations: ['asset', 'scheduledBy', 'completedBy'],
      order: { maintenanceDate: 'DESC' },
    });
  }
}
