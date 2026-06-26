import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CustomReward } from '../entities/custom-reward.entity';

@Injectable()
export class CustomRewardsService {
  private readonly logger = new Logger(CustomRewardsService.name);

  constructor(private readonly dataSource: DataSource) {}

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
    return repo.save(reward);
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
  ): Promise<CustomReward> {
    const repo = this.dataSource.getRepository(CustomReward);
    const reward = await repo.findOne({ where: { id: rewardId, tenantId } });
    if (!reward) {
      throw new Error('Custom reward not found');
    }
    Object.assign(reward, data);
    return repo.save(reward);
  }

  async softDelete(tenantId: string, rewardId: string): Promise<void> {
    const repo = this.dataSource.getRepository(CustomReward);
    const reward = await repo.findOne({ where: { id: rewardId, tenantId } });
    if (!reward) {
      throw new Error('Custom reward not found');
    }
    await repo.softRemove(reward);
  }
}
