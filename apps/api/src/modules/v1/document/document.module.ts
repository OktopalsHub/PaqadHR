import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FilesController } from 'src/common/controllers/files.controller';
import { FileModule } from 'src/common/modules/file.module';
import { CloudflareR2Service } from 'src/common/services/cloudflare-r2.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { TenantMembersModule } from '../tenant-members/tenant-members.module';
import { TenantsModule } from '../tenants/tenants.module';
import { DocumentRepository } from './document.repository';
import { DocumentService } from './document-orchestrator';
import { DocumentUploadController } from './document-upload.controller';
import { DocumentUploadService } from './document-upload.service';
import { DocumentVerificationService } from './document-verification.service';
import { DocumentVerifyController } from './document-verify.controller';
import { Document } from './entities/document.entity';
import { RetentionCronService } from './services/retention-cron.service';
@Module({
  imports: [
    TypeOrmModule.forFeature([Document]),
    FileModule,
    TenantsModule,
    TenantMembersModule,
    NotificationsModule,
  ],
  controllers: [DocumentUploadController, DocumentVerifyController, FilesController],
  providers: [
    DocumentService,
    DocumentUploadService,
    DocumentVerificationService,
    DocumentRepository,
    CloudflareR2Service,
    RetentionCronService,
  ],
  exports: [DocumentService],
})
export class DocumentModule {}
