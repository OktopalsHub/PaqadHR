import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivitiesModule } from '../activities/activities.module';
import { DepartmentsModule } from '../departments/departments.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PositionModule } from '../position/position.module';
import { TenantMembersModule } from '../tenant-members/tenant-members.module';
import { TenantsModule } from '../tenants/tenants.module';
import { UsersModule } from '../users/users.module';
import { Invitation } from './entities/invitation.entity';
import { InvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';
import { PublicInvitesController } from './public-invites.controller';
import { InvitationsRepository } from './repositories/invitations.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invitation]),
    forwardRef(() => TenantMembersModule),
    UsersModule,
    TenantsModule,
    NotificationsModule,
    ActivitiesModule,
    DepartmentsModule,
    PositionModule,
  ],
  controllers: [InvitationsController, PublicInvitesController],
  providers: [InvitationsService, InvitationsRepository],
  exports: [InvitationsService],
})
export class InvitationsModule {}
