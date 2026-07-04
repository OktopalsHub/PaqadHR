import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { CreateAuditLogPayload } from '../../../../common/interfaces/create-audit-log-payload.interface';
import { AuditLog } from '../entities/audit-log.entity';

@Injectable()
export class AuditLogsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuditLogsService.name);
  private readonly queue: CreateAuditLogPayload[] = [];
  private drainTimer: ReturnType<typeof setInterval> | null = null;
  private draining = false;

  public static readonly testLogs: CreateAuditLogPayload[] = [];

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  async onModuleInit(): Promise<void> {
    this.drainTimer = setInterval(() => {
      void this.drainQueue();
    }, 250);
  }

  async queueAuditLog(payload: CreateAuditLogPayload): Promise<void> {
    if (process.env.NODE_ENV === 'test') {
      AuditLogsService.testLogs.push(payload);
      return;
    }
    this.queue.push(payload);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.drainTimer) {
      clearInterval(this.drainTimer);
      this.drainTimer = null;
    }
    await this.drainQueue();
  }

  private async drainQueue(): Promise<void> {
    if (this.draining || this.queue.length === 0) return;
    this.draining = true;

    try {
      const batch = this.queue.splice(0, 25);
      const entities = batch.map((entry) =>
        this.auditLogRepository.create({
          action: entry.action,
          description: entry.description,
          severity: entry.severity,
          status: entry.status,
          resourceType: entry.resourceType ?? null,
          resourceId: entry.resourceId ?? null,
          tenantId: entry.tenantId ?? null,
          userId: entry.userId ?? null,
          ipAddress: entry.ipAddress ?? null,
          userAgent: entry.userAgent ?? null,
          metadata: entry.metadata ?? null,
        }),
      );

      await this.auditLogRepository.save(entities);
    } catch (error) {
      this.logger.error(
        `Failed to persist audit log batch: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.draining = false;
    }
  }
}
