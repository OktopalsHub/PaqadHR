import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { runCronJob } from 'src/common/utils/cron-logging.util';
import { LessThan, Repository } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';

const RETENTION_DAYS = 90;
const BATCH_SIZE = 500;

@Injectable()
export class AuditLogRetentionCronService {
  private readonly logger = new Logger(AuditLogRetentionCronService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async purgeOldAuditLogs(): Promise<void> {
    await runCronJob(this.logger, 'audit-log-retention', async () => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

      let totalPurged = 0;
      for (;;) {
        const staleLogs = await this.auditLogRepository.find({
          where: { createdAt: LessThan(cutoff) },
          select: ['id'],
          take: BATCH_SIZE,
        });

        if (staleLogs.length === 0) {
          break;
        }

        await this.auditLogRepository.delete(staleLogs.map((log) => log.id));
        totalPurged += staleLogs.length;

        if (staleLogs.length < BATCH_SIZE) {
          break;
        }
      }

      return { purged: totalPurged };
    });
  }
}
