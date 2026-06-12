import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantMembersModule } from '../../tenant-members/tenant-members.module';
import { TenantsModule } from '../../tenants/tenants.module';
import { AssetAssignmentController } from './asset-assignment.controller';
import { AssetAssignmentRepository } from './asset-assignment.repository';
import { AssetAssignmentService } from './asset-assignment.service';
import { AssetAssignment } from "./entities/asset-assignment.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([AssetAssignment]),
    TenantsModule,
    TenantMembersModule,
  ],
  controllers: [AssetAssignmentController],
  providers: [AssetAssignmentService, AssetAssignmentRepository],
  exports: [AssetAssignmentService, AssetAssignmentRepository],
})
export class AssetAssignmentModule {}
