import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { AuditSeverity, AuditStatus } from 'src/common/enums/audit-action.enum';
import { runCronJob } from 'src/common/utils/cron-logging.util';
import { Repository } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';

const AUDIT_RETENTION_DAYS = Number(process.env.AUDIT_RETENTION_DAYS ?? 90);
const AUDIT_FAILED_HIGH_RETENTION_DAYS = Number(
  process.env.AUDIT_FAILED_HIGH_RETENTION_DAYS ?? 365,
);

@Injectable()
export class AuditRetentionCronService {
  private readonly logger = new Logger(AuditRetentionCronService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeExpiredAuditLogs(): Promise<void> {
    await runCronJob(this.logger, 'audit-retention', async () => {
      const standardCutoff = new Date();
      standardCutoff.setDate(standardCutoff.getDate() - AUDIT_RETENTION_DAYS);
      const extendedCutoff = new Date();
      extendedCutoff.setDate(extendedCutoff.getDate() - AUDIT_FAILED_HIGH_RETENTION_DAYS);

      // Standard logs: delete all older than 90d
      const standardDeleted = await this.auditLogRepository
        .createQueryBuilder()
        .delete()
        .from(AuditLog)
        .where('created_at < :cutoff', { cutoff: standardCutoff })
        .andWhere('(severity != :severity OR status != :status)', {
          severity: AuditSeverity.HIGH,
          status: AuditStatus.FAILED,
        })
        .execute();

      // High severity failed logs: keep 1y
      const highDeleted = await this.auditLogRepository
        .createQueryBuilder()
        .delete()
        .from(AuditLog)
        .where('created_at < :cutoff', { cutoff: extendedCutoff })
        .andWhere('severity = :severity AND status = :status', {
          severity: AuditSeverity.HIGH,
          status: AuditStatus.FAILED,
        })
        .execute();

      return { purged: (standardDeleted.affected ?? 0) + (highDeleted.affected ?? 0) };
    });
  }
}
