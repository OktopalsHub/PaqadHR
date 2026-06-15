import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssetAssignmentModule } from '../assets/assignment/asset-assignment.module';
import { AssetCategoryModule } from '../assets/category/asset-category.module';
import { TenantMembersModule } from '../tenant-members/tenant-members.module';
import { TenantsModule } from '../tenants/tenants.module';
import { AssetController } from './assets.controller';
import { AssetService } from './assets.service';
import { Asset } from './entities/asset.entity';
import { AssetRepository } from './repositories/asset.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([Asset]),
    TenantsModule,
    TenantMembersModule,
    AssetCategoryModule,
    AssetAssignmentModule,
  ],
  controllers: [AssetController],
  providers: [AssetService, AssetRepository],
  exports: [AssetService, AssetRepository],
})
export class AssetsModule {}
