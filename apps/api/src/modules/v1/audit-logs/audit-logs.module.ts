import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { AuditLogRetentionCronService } from './services/audit-log-retention-cron.service';
import { AuditLogsService } from './services/audit-logs.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  providers: [AuditLogsService, AuditLogRetentionCronService],
  exports: [AuditLogsService],
})
export class AuditLogsModule {}
