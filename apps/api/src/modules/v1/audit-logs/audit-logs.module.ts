import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { AuditLogsService } from './services/audit-logs.service';
import { AuditRetentionCronService } from './services/audit-retention.cron';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  providers: [AuditLogsService, AuditRetentionCronService],
  exports: [AuditLogsService],
})
export class AuditLogsModule {}
