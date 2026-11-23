import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type { CreateAuditLogPayload } from '../../../../common/interfaces/create-audit-log-payload.interface';
import { AuditLog } from '../entities/audit-log.entity';

const MAX_QUEUE_SIZE = 10_000;
const MAX_ATTEMPTS = 5;

@Injectable()
export class AuditLogsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuditLogsService.name);
  private readonly queue: CreateAuditLogPayload[] = [];
  private drainTimer: ReturnType<typeof setInterval> | null = null;
  private draining = false;
  private readonly attempts = new WeakMap<object, number>();

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
    // Written before the caller continues, so a crash right after an action cannot lose its
    // audit record. Only a failed write falls back to the in-memory retry queue.
    try {
      await this.auditLogRepository.save(this.toEntity(payload));
    } catch (error) {
      this.logger.error(
        `Failed to persist audit log, queued for retry: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.enqueue(payload);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.drainTimer) {
      clearInterval(this.drainTimer);
      this.drainTimer = null;
    }
    await this.drainQueue();
  }

  private toEntity(entry: CreateAuditLogPayload): AuditLog {
    return this.auditLogRepository.create({
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
    });
  }

  private enqueue(entry: CreateAuditLogPayload): void {
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      this.queue.shift();
      this.logger.warn('audit log queue is full; dropped the oldest entry');
    }
    this.queue.push(entry);
  }

  private async drainQueue(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      while (this.queue.length > 0) {
        const batch = this.queue.splice(0, 25);
        try {
          const entities = batch.map((entry) => this.toEntity(entry));

          await this.auditLogRepository.save(entities);

        } catch (error) {
          this.requeueFailed(batch);
          this.logger.error(
            `Failed to persist audit log batch: ${error instanceof Error ? error.message : String(error)}`,
          );
          return;
        }
      }
    } finally {
      this.draining = false;
    }
  }

  private requeueFailed(batch: Array<CreateAuditLogPayload>): void {
    const keep = batch.filter((entry) => {
      const attempts = (this.attempts.get(entry) ?? 0) + 1;
      this.attempts.set(entry, attempts);
      return attempts < MAX_ATTEMPTS;
    });
    this.queue.unshift(...keep);
    if (keep.length < batch.length) {
      this.logger.error(`Dropped ${batch.length - keep.length} audit log entries after repeated failures`);
    }
  }
}
