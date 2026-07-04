import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantActivity } from '../entities/tenant-activity.entity';
import type { CreateActivityPayload } from '../interfaces/create-activity-payload.interface';

export interface ListActivitiesQuery {
  page?: number;
  limit?: number;
  resourceType?: string;
  action?: string;
  resourceId?: string;
}

@Injectable()
export class ActivitiesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ActivitiesService.name);
  private readonly queue: CreateActivityPayload[] = [];
  private drainTimer: ReturnType<typeof setInterval> | null = null;
  private draining = false;

  public static readonly testLogs: CreateActivityPayload[] = [];

  constructor(
    @InjectRepository(TenantActivity)
    private readonly activityRepository: Repository<TenantActivity>,
  ) {}

  async onModuleInit(): Promise<void> {
    this.drainTimer = setInterval(() => {
      void this.drainQueue();
    }, 250);
  }

  async queueActivity(payload: CreateActivityPayload): Promise<void> {
    if (process.env.NODE_ENV === 'test') {
      ActivitiesService.testLogs.push(payload);
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

  async listForTenant(
    tenantId: string,
    query: ListActivitiesQuery = {},
  ): Promise<{ items: TenantActivity[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));

    const qb = this.activityRepository
      .createQueryBuilder('activity')
      .where('activity.tenant_id = :tenantId', { tenantId })
      .orderBy('activity.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.resourceType) {
      qb.andWhere('activity.resource_type = :resourceType', {
        resourceType: query.resourceType,
      });
    }
    if (query.action) {
      qb.andWhere('activity.action = :action', { action: query.action });
    }
    if (query.resourceId) {
      qb.andWhere('activity.resource_id = :resourceId', { resourceId: query.resourceId });
    }

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit };
  }

  async listForResource(
    tenantId: string,
    resourceType: string,
    resourceId: string,
    limit = 100,
  ): Promise<TenantActivity[]> {
    return this.activityRepository.find({
      where: { tenantId, resourceType, resourceId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  private async drainQueue(): Promise<void> {
    if (this.draining || this.queue.length === 0) return;
    this.draining = true;

    try {
      const batch = this.queue.splice(0, 25);
      const entities = batch.map((entry) =>
        this.activityRepository.create({
          tenantId: entry.tenantId,
          actorMemberId: entry.actorMemberId ?? null,
          action: entry.action,
          resourceType: entry.resourceType ?? null,
          resourceId: entry.resourceId ?? null,
          description: entry.description,
          status: entry.status ?? 'SUCCESS',
          severity: entry.severity ?? 'LOW',
          ipAddress: entry.ipAddress ?? null,
          userAgent: entry.userAgent ?? null,
          metadata: entry.metadata ?? null,
        }),
      );

      await this.activityRepository.save(entities);
    } catch (error) {
      this.logger.error(
        `Failed to persist activity batch: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.draining = false;
    }
  }
}
