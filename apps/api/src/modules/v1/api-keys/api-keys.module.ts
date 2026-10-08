import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiKeyAuthGuard } from '../../../common/guards/api-key-auth.guard';
import { TenantMembersModule } from '../tenant-members/tenant-members.module';
import { ApiKeysController } from './api-keys.controller';
import { ApiKey } from './entities/api-key.entity';
import { ApiKeysService } from './services/api-keys.service';

@Module({
  imports: [TypeOrmModule.forFeature([ApiKey]), TenantMembersModule],
  controllers: [ApiKeysController],
  providers: [ApiKeysService, ApiKeyAuthGuard],
  exports: [ApiKeysService, ApiKeyAuthGuard],
})
export class ApiKeysModule {}
