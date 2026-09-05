import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivitiesModule } from '../activities/activities.module';
import { TenantMembersModule } from '../tenant-members/tenant-members.module';
import { TenantsModule } from '../tenants/tenants.module';
import { EducationController } from './education.controller';
import { EducationRepository } from './education.repository';
import { EducationService } from './education.service';
import { Education } from './entities/education.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Education]),
    forwardRef(() => TenantsModule),
    forwardRef(() => TenantMembersModule),
    forwardRef(() => ActivitiesModule),
  ],
  controllers: [EducationController],
  providers: [EducationService, EducationRepository],
  exports: [EducationService],
})
export class EducationModule {}
