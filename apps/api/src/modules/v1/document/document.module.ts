import { Document } from './entities/document.entity';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentService } from './document.service';
import { DocumentController } from './document.controller';
import { DocumentRepository } from './document.repository';
import { TenantMembersModule } from '../tenant-members/tenant-members.module';
import { TenantsModule } from '../tenants/tenants.module';
import { FileModule } from 'src/common/modules/file.module';
import { CloudflareR2Service } from 'src/common/services/cloudflare-r2.service';
@Module({
  imports: [
    TypeOrmModule.forFeature([Document]),
    FileModule,
    TenantsModule,
    TenantMembersModule,
  ],
  controllers: [DocumentController],
  providers: [DocumentService, DocumentRepository, CloudflareR2Service],
  exports: [DocumentService],
})
export class DocumentModule {}
