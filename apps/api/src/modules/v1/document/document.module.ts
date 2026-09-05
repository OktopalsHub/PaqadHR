import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FilesController } from 'src/common/controllers/files.controller';
import { FileModule } from 'src/common/modules/file.module';
import { CloudflareR2Service } from 'src/common/services/cloudflare-r2.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { TenantMembersModule } from '../tenant-members/tenant-members.module';
import { TenantsModule } from '../tenants/tenants.module';
import { DocumentController } from './document.controller';
import { DocumentRepository } from './document.repository';
import { DocumentService } from './document.service';
import { Document } from './entities/document.entity';
import { RetentionCronService } from './services/retention-cron.service';
@Module({
  imports: [
    TypeOrmModule.forFeature([Document]),
    FileModule,
    forwardRef(() => TenantsModule),
    forwardRef(() => TenantMembersModule),
    forwardRef(() => NotificationsModule),
  ],
  controllers: [DocumentController, FilesController],
  providers: [DocumentService, DocumentRepository, CloudflareR2Service, RetentionCronService],
  exports: [DocumentService],
})
export class DocumentModule {}
