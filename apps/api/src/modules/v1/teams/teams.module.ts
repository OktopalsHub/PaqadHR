import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantMembersModule } from '../tenant-members/tenant-members.module';
import { TenantsModule } from '../tenants/tenants.module';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';
import { Team } from "./entities/team.entity";
import { TeamMember } from "./entities/team-member.entity";
import { TeamsRepository } from "./repositories/teams.repository";
import { TeamMembersRepository } from "./repositories/team-members.repository";

@Module({
  imports: [
    TypeOrmModule.forFeature([Team, TeamMember]),
    TenantsModule,
    TenantMembersModule,
  ],
  controllers: [TeamsController],
  providers: [TeamsService, TeamsRepository, TeamMembersRepository],
  exports: [TeamsService],
})
export class TeamsModule {}
