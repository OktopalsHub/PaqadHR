import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeamsModule } from '../teams/teams.module';
import { TenantMembersModule } from '../tenant-members/tenant-members.module';
import { TenantsModule } from '../tenants/tenants.module';
import { DepartmentsController } from './departments.controller';
import { DepartmentsService } from './departments.service';
import { Department } from "./entities/department.entity";
import { DepartmentMember } from "./entities/department-member.entity";
import { Team } from "../teams/entities/team.entity";
import { DepartmentsRepository } from "./repositories/departments.repository";
import { DepartmentMembersRepository } from "./repositories/department-members.repository";

@Module({
  imports: [
    TypeOrmModule.forFeature([Department, DepartmentMember, Team]),
    TenantsModule,
    TenantMembersModule,
    TeamsModule,
  ],
  controllers: [DepartmentsController],
  providers: [
    DepartmentsService,
    DepartmentsRepository,
    DepartmentMembersRepository,
  ],
  exports: [DepartmentsService],
})
export class DepartmentsModule {}
