import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantMembersModule } from '../../tenant-members/tenant-members.module';
import { TenantsModule } from '../../tenants/tenants.module';
import { AssetsModule } from '../assets.module';
import { AssetMaintenanceController } from './asset-maintenance.controller';
import { AssetMaintenanceRepository } from './asset-maintenance.repository';
import { AssetMaintenanceService } from './asset-maintenance.service';
import { AssetMaintenance } from './entities/asset-maintenance.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([AssetMaintenance]),
    TenantsModule,
    TenantMembersModule,
    AssetsModule,
  ],
  controllers: [AssetMaintenanceController],
  providers: [AssetMaintenanceService, AssetMaintenanceRepository],
  exports: [AssetMaintenanceService],
})
export class AssetMaintenanceModule {}
