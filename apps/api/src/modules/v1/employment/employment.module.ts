import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmploymentService } from './employment.service';
import { EmploymentController } from './employment.controller';
import { EmploymentRepository } from './employment.repository';
import { PositionModule } from '../position/position.module';
import { TenantMembersModule } from '../tenant-members/tenant-members.module';
import { TenantsModule } from '../tenants/tenants.module';
import { Employment } from "./entities/employment.entity";
import { Tenant } from "../tenants/entities/tenant.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([Employment, Tenant]),
    PositionModule,
    TenantsModule,
    TenantMembersModule,
  ],
  controllers: [EmploymentController],
  providers: [EmploymentService, EmploymentRepository],
  exports: [EmploymentService],
})
export class EmploymentModule {}
