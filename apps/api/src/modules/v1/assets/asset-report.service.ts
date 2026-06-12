import { Injectable } from '@nestjs/common';
import { AssetMaintenanceRepository } from './maintenance/asset-maintenance.repository';
import { AssetAssignmentRepository } from './assignment/asset-assignment.repository';
import { AssetRepository } from "./repositories/asset.repository";

@Injectable()
export class AssetReportService {
  constructor(
    private readonly assetRepository: AssetRepository,
    private readonly assetMaintenanceRepository: AssetMaintenanceRepository,
    private readonly assetAssignmentRepository: AssetAssignmentRepository,
  ) {}
  async getInventoryReport(
    tenantId: string,
    filters: Record<string, unknown> = {},
  ) {
    const { assets } = await this.assetRepository.findByTenant(tenantId, {
      ...(filters as object),
      page: 1,
      limit: 10,
    });
    const summary = {
      byType: {},
      byStatus: {},
      byCondition: {},
      byCategory: {},
    };
    assets.forEach((asset) => {
      summary.byType[asset.type] = (summary.byType[asset.type] || 0) + 1;
      summary.byStatus[asset.status] =
        (summary.byStatus[asset.status] || 0) + 1;
      summary.byCondition[asset.condition] =
        (summary.byCondition[asset.condition] || 0) + 1;
      const categoryName = asset.category?.name || 'Uncategorized';
      summary.byCategory[categoryName] =
        (summary.byCategory[categoryName] || 0) + 1;
    });
    return {
      summary,
      assets,
    };
  }
  async getMaintenanceReport(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    type?: string,
  ) {
    const maintenanceRecords = type
      ? await this.assetMaintenanceRepository.findMaintenanceByType(
          tenantId,
          type,
          startDate,
          endDate,
        )
      : await this.assetMaintenanceRepository.findScheduledMaintenance(
          tenantId,
          startDate,
          endDate,
        );
    const costs =
      await this.assetMaintenanceRepository.getMaintenanceCostsByPeriod(
        tenantId,
        startDate,
        endDate,
      );
    const upcoming =
      await this.assetMaintenanceRepository.findUpcomingMaintenance(
        tenantId,
        30,
      );
    const overdue =
      await this.assetMaintenanceRepository.findOverdueMaintenance(tenantId);
    return {
      period: { startDate, endDate },
      costs,
      scheduled: maintenanceRecords,
      upcoming,
      overdue,
      summary: {
        totalScheduled: maintenanceRecords.length,
        totalUpcoming: upcoming.length,
        totalOverdue: overdue.length,
      },
    };
  }
  async getDepreciationReport(
    tenantId: string,
    year: number,
    categoryId?: string,
  ) {
    const filters: Record<string, unknown> = {};
    if (categoryId) {
      filters.categoryId = categoryId;
    }
    const { assets } = await this.assetRepository.findByTenant(tenantId, {
      ...filters,
      page: 1,
      limit: 1000,
    });
    const deprecationData = assets.map((asset) => {
      const purchaseYear = new Date(asset.purchaseDate).getFullYear();
      const yearsOwned = year - purchaseYear;
      const depreciationRate = asset.category?.depreciationRate || 0;
      const annualDepreciation = asset.purchasePrice * (depreciationRate / 100);
      const totalDepreciation = Math.min(
        annualDepreciation * yearsOwned,
        asset.purchasePrice,
      );
      const currentValue = asset.purchasePrice - totalDepreciation;
      return {
        asset: {
          id: asset.id,
          name: asset.name,
          category: asset.category?.name,
          purchasePrice: asset.purchasePrice,
          purchaseDate: asset.purchaseDate,
        },
        depreciation: {
          yearsOwned,
          depreciationRate,
          annualDepreciation,
          totalDepreciation,
          currentValue: Math.max(currentValue, 0),
        },
      };
    });
    const totalPurchaseValue = deprecationData.reduce(
      (sum, item) => sum + item.asset.purchasePrice,
      0,
    );
    const totalCurrentValue = deprecationData.reduce(
      (sum, item) => sum + item.depreciation.currentValue,
      0,
    );
    const totalDepreciation = totalPurchaseValue - totalCurrentValue;
    return {
      year,
      summary: {
        totalAssets: assets.length,
        totalPurchaseValue,
        totalCurrentValue,
        totalDepreciation,
        depreciationPercentage:
          totalPurchaseValue > 0
            ? (totalDepreciation / totalPurchaseValue) * 100
            : 0,
      },
      assets: deprecationData,
    };
  }
  async getAssignmentReport(tenantId: string) {
    const overdueAssignments =
      await this.assetAssignmentRepository.findOverdueAssignments(tenantId);
    return {
      overdue: overdueAssignments,
      summary: {
        totalOverdue: overdueAssignments.length,
      },
    };
  }
}
