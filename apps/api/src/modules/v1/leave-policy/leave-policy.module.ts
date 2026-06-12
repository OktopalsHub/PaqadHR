import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantMembersModule } from '../tenant-members/tenant-members.module';
import { TenantsModule } from '../tenants/tenants.module';
import { LeavePolicyController } from './leave-policy.controller';
import { LeavePolicyRepository } from './leave-policy.repository';
import { LeavePolicyService } from './leave-policy.service';
import { LeavePolicy } from "./entities/leave-policy.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([LeavePolicy]),
    TenantsModule,
    TenantMembersModule,
  ],
  controllers: [LeavePolicyController],
  providers: [LeavePolicyService, LeavePolicyRepository],
  exports: [LeavePolicyService],
})
export class LeavePolicyModule {}
