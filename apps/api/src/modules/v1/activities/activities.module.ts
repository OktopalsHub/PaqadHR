import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileModule } from 'src/common/modules/file.module';
import { TenantMembersModule } from '../tenant-members/tenant-members.module';
import { ActivitiesController } from './controllers/activities.controller';
import { TenantActivity } from './entities/tenant-activity.entity';
import { ActivityQueueListener } from './listeners/activity-queue.listener';
import { ActivitiesService } from './services/activities.service';

@Module({
  imports: [TypeOrmModule.forFeature([TenantActivity]), TenantMembersModule, FileModule],
  controllers: [ActivitiesController],
  providers: [ActivitiesService, ActivityQueueListener],
  exports: [ActivitiesService],
})
export class ActivitiesModule {}
