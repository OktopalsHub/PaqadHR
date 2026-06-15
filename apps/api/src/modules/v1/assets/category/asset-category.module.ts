import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantMembersModule } from '../../tenant-members/tenant-members.module';
import { TenantsModule } from '../../tenants/tenants.module';
import { AssetCategoryController } from './asset-category.controllers';
import { AssetCategoryRepository } from './asset-category.repository';
import { AssetCategoryService } from './asset-category.service';
import { AssetCategory } from './entities/asset-category.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AssetCategory]), TenantsModule, TenantMembersModule],
  controllers: [AssetCategoryController],
  providers: [AssetCategoryService, AssetCategoryRepository],
  exports: [AssetCategoryService],
})
export class AssetCategoryModule {}
