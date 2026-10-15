import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ActivitiesService } from '../../activities/services/activities.service';
import { CustomReward } from '../entities/custom-reward.entity';

@Injectable()
export class CustomRewardsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly activitiesService: ActivitiesService,
  ) {}

  async list(tenantId: string, includeInactive = false): Promise<CustomReward[]> {
    const repo = this.dataSource.getRepository(CustomReward);
    const qb = repo
      .createQueryBuilder('cr')
      .where('cr.tenant_id = :tenantId', { tenantId })
      .orderBy('cr.created_at', 'DESC');

    if (!includeInactive) {
      qb.andWhere('cr.is_active = true');
    }

    return qb.getMany();
  }

  async create(
    tenantId: string,
    data: {
      title: string;
      description?: string;
      pointsCost: number;
      imageUrl?: string;
      stockLimit?: number;
      deliveryInstructions?: string;
    },
    actorMemberId?: string,
  ): Promise<CustomReward> {
    const repo = this.dataSource.getRepository(CustomReward);
    const reward = repo.create({
      tenantId,
      title: data.title,
      description: data.description ?? null,
      pointsCost: data.pointsCost,
      imageUrl: data.imageUrl ?? null,
      stockLimit: data.stockLimit ?? null,
      deliveryInstructions: data.deliveryInstructions ?? null,
    });
    const saved = await repo.save(reward);
    if (actorMemberId) {
      void this.activitiesService
        .queueActivity({
          tenantId,
          actorMemberId,
          action: 'reward.custom_created',
          resourceType: 'custom_reward',
          resourceId: saved.id,
          description: `Custom reward "${data.title}" created`,
          metadata: { title: data.title, pointsCost: data.pointsCost },
        })
        .catch(() => {});
    }
    return saved;
  }

  async update(
    tenantId: string,
    rewardId: string,
    data: Partial<{
      title: string;
      description: string;
      pointsCost: number;
      imageUrl: string;
      isActive: boolean;
      stockLimit: number;
      deliveryInstructions: string;
    }>,
    actorMemberId?: string,
  ): Promise<CustomReward> {
    const repo = this.dataSource.getRepository(CustomReward);
    const reward = await repo.findOne({ where: { id: rewardId, tenantId } });
    if (!reward) {
      throw new NotFoundException('Custom reward not found');
    }
    Object.assign(reward, data);
    const saved = await repo.save(reward);
    if (actorMemberId) {
      void this.activitiesService
        .queueActivity({
          tenantId,
          actorMemberId,
          action: 'reward.custom_updated',
          resourceType: 'custom_reward',
          resourceId: rewardId,
          description: `Custom reward "${reward.title}" updated`,
          metadata: { changes: data },
        })
        .catch(() => {});
    }
    return saved;
  }

  async softDelete(tenantId: string, rewardId: string, actorMemberId?: string): Promise<void> {
    const repo = this.dataSource.getRepository(CustomReward);
    const reward = await repo.findOne({ where: { id: rewardId, tenantId } });
    if (!reward) {
      throw new NotFoundException('Custom reward not found');
    }
    await repo.softRemove(reward);
    if (actorMemberId) {
      void this.activitiesService
        .queueActivity({
          tenantId,
          actorMemberId,
          action: 'reward.custom_deleted',
          resourceType: 'custom_reward',
          resourceId: rewardId,
          description: `Custom reward "${reward.title}" deleted`,
          metadata: { title: reward.title },
        })
        .catch(() => {});
    }
  }
}
