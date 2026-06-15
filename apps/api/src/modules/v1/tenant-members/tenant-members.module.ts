import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileModule } from '../../../common/modules/file.module';
import { TenantSettings } from '../tenant-settings/entities/tenant-settings.entity';
import { TenantConfigModule } from '../tenant-settings/tenant-config.module';
import { Tenant } from '../tenants/entities/tenant.entity';
import { TenantCounter } from './entities/tenant-counter.entity';
import { TenantMember } from './entities/tenant-member.entity';
import { HeaderTenantMemberGuard } from './guards/header-tenant-member.guard';
import { TenantMemberGuard } from './guards/tenant-members.guards';
import { PublicTenantMembersController } from './public-tenant-members.controller';
import { TenantCounterRepository } from './repositories/tenant-counter.repository';
import { TenantMemberRepository } from './repositories/tenant-members.repository';
import { TenantMembersController } from './tenant-members.controller';
import { TenantMembersService } from './tenant-members.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TenantMember, TenantCounter, Tenant, TenantSettings]),
    TenantConfigModule,
    FileModule,
  ],
  controllers: [TenantMembersController, PublicTenantMembersController],
  providers: [
    TenantMembersService,
    TenantMemberRepository,
    TenantCounterRepository,
    TenantMemberGuard,
    HeaderTenantMemberGuard,
  ],
  exports: [TenantMembersService, TenantMemberGuard, HeaderTenantMemberGuard, TypeOrmModule],
})
export class TenantMembersModule {}
