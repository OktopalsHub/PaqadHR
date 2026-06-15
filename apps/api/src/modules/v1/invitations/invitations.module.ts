import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
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
    TenantMembersModule,
    UsersModule,
    TenantsModule,
  ],
  controllers: [InvitationsController, PublicInvitesController],
  providers: [InvitationsService, InvitationsRepository],
  exports: [InvitationsService],
})
export class InvitationsModule {}
