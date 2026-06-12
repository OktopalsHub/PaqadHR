import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantConfigModule } from '../tenant-settings/tenant-config.module';
import { PublicTenantMembersController } from './public-tenant-members.controller';
import { TenantMembersController } from './tenant-members.controller';
import { TenantMembersService } from './tenant-members.service';
import { TenantMember } from './entities/tenant-member.entity';
import { TenantCounter } from './entities/tenant-counter.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { TenantMemberRepository } from './repositories/tenant-members.repository';
import { TenantCounterRepository } from './repositories/tenant-counter.repository';
import { TenantMemberGuard } from './guards/tenant-members.guards';
import { TenantSettings } from '../tenant-settings/entities/tenant-settings.entity';
import { FileModule } from '../../../common/modules/file.module';

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
  ],
  exports: [TenantMembersService, TenantMemberGuard],
})
export class TenantMembersModule {}
