import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../database/entities/audit-log.entity';
import type { CreateAuditLogPayload } from '../interfaces/create-audit-log-payload.interface';

@Injectable()
export class AuditLogsService implements OnModuleDestroy {
  private readonly logger = new Logger(AuditLogsService.name);
  private readonly queue: CreateAuditLogPayload[] = [];
  private processing = false;
  private drainTimer: ReturnType<typeof setImmediate> | null = null;

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  async queueAuditLog(payload: CreateAuditLogPayload): Promise<void> {
    this.queue.push(payload);
    this.scheduleDrain();
  }

  async onModuleDestroy(): Promise<void> {
    await this.drainQueue();
  }

  private scheduleDrain(): void {
    if (this.processing || this.drainTimer) return;
    this.drainTimer = setImmediate(() => {
      this.drainTimer = null;
      void this.drainQueue();
    });
  }

  private async drainQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    try {
      while (this.queue.length > 0) {
        const batch = this.queue.splice(0, 25).map((entry) =>
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
        await this.auditLogRepository.save(batch);
      }
    } catch (error) {
      this.logger.error(
        `Failed to persist audit log batch: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.processing = false;
      if (this.queue.length > 0) {
        this.scheduleDrain();
      }
    }
  }
}
