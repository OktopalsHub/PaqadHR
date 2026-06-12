import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ShoutoutCategory } from '../entities/shoutout-category.entity';

@Injectable()
export class ShoutoutCategoriesRepository extends Repository<ShoutoutCategory> {
  constructor(
    @InjectRepository(ShoutoutCategory)
    private readonly categoryRepository: Repository<ShoutoutCategory>,
  ) {
    super(
      categoryRepository.target,
      categoryRepository.manager,
      categoryRepository.queryRunner,
    );
  }

  async listByTenant(tenantId: string): Promise<ShoutoutCategory[]> {
    return this.find({
      where: { tenantId, isActive: true },
      order: { name: 'ASC' },
    });
  }

  async getById(tenantId: string, id: string): Promise<ShoutoutCategory | null> {
    return this.findOne({ where: { id, tenantId } });
  }

  async getFirstActive(tenantId: string): Promise<ShoutoutCategory | null> {
    return this.findOne({
      where: { tenantId, isActive: true },
      order: { createdAt: 'ASC' },
    });
  }

  async listByIds(tenantId: string, ids: string[]): Promise<ShoutoutCategory[]> {
    if (ids.length === 0) return [];
    return this.createQueryBuilder('category')
      .where('category.tenant_id = :tenantId', { tenantId })
      .andWhere('category.id IN (:...ids)', { ids })
      .andWhere('category.is_active = true')
      .getMany();
  }
}
