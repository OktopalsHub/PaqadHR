import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivitiesModule } from '../activities/activities.module';
import { PositionModule } from '../position/position.module';
import { TenantMembersModule } from '../tenant-members/tenant-members.module';
import { Tenant } from '../tenants/entities/tenant.entity';
import { TenantsModule } from '../tenants/tenants.module';
import { EmploymentController } from './employment.controller';
import { EmploymentRepository } from './employment.repository';
import { EmploymentService } from './employment.service';
import { Employment } from './entities/employment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Employment, Tenant]),
    PositionModule,
    TenantsModule,
    TenantMembersModule,
    ActivitiesModule,
  ],
  controllers: [EmploymentController],
  providers: [EmploymentService, EmploymentRepository],
  exports: [EmploymentService],
})
export class EmploymentModule {}
