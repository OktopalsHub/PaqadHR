import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivitiesModule } from '../activities/activities.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TenantMembersModule } from '../tenant-members/tenant-members.module';
import { TenantConfigModule } from '../tenant-settings/tenant-config.module';
import { ShoutoutMemberPoints } from './entities/shoutout-member-points.entity';
import { ShoutoutPointTransaction } from './entities/shoutout-point-transaction.entity';
import { MemberPointsRepository } from './repositories/member-points.repository';
import { MemberPointsService } from './services/member-points.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ShoutoutMemberPoints, ShoutoutPointTransaction]),
    TenantConfigModule,
    TenantMembersModule,
    ActivitiesModule,
    NotificationsModule,
  ],
  providers: [MemberPointsRepository, MemberPointsService],
  exports: [MemberPointsService],
})
export class ShoutoutPointsModule {}
