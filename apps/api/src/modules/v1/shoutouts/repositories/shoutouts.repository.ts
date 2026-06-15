import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type EntityManager, Repository } from 'typeorm';
import { Shoutout } from '../entities/shoutout.entity';
import { ShoutoutCategoryAssignment } from '../entities/shoutout-category-assignment.entity';
import { ShoutoutRecipient } from '../entities/shoutout-recipient.entity';
import type { ShoutoutFilters } from '../interfaces/shoutout-filters.interface';

@Injectable()
export class ShoutoutsRepository extends Repository<Shoutout> {
  constructor(@InjectRepository(Shoutout) readonly shoutoutRepository: Repository<Shoutout>) {
    super(shoutoutRepository.target, shoutoutRepository.manager, shoutoutRepository.queryRunner);
  }

  async listPaginated(
    tenantId: string,
    filters: ShoutoutFilters,
  ): Promise<{ records: Shoutout[]; total: number }> {
    const queryBuilder = this.createQueryBuilder('shoutout')
      .leftJoinAndSelect('shoutout.creator', 'creator')
      .leftJoinAndSelect('shoutout.recipients', 'recipients')
      .leftJoinAndSelect('recipients.recipient', 'recipient')
      .leftJoinAndSelect('shoutout.categoryAssignments', 'categoryAssignments')
      .leftJoinAndSelect('categoryAssignments.category', 'category')
      .where('shoutout.tenantId = :tenantId', { tenantId })
      .orderBy('shoutout.createdAt', 'DESC');

    if (filters.categoryIds?.length) {
      queryBuilder.andWhere('category.id IN (:...categoryIds)', {
        categoryIds: filters.categoryIds,
      });
    }

    if (filters.senderId) {
      queryBuilder.andWhere('shoutout.createdBy = :senderId', {
        senderId: filters.senderId,
      });
    }

    if (filters.recipientId) {
      queryBuilder.andWhere('recipients.recipientId = :recipientId', {
        recipientId: filters.recipientId,
      });
    }

    const total = await queryBuilder.getCount();
    const records = await queryBuilder
      .skip((filters.page - 1) * filters.limit)
      .take(filters.limit)
      .getMany();

    return { records, total };
  }

  async getById(tenantId: string, id: string): Promise<Shoutout | null> {
    return this.findOne({
      where: { id, tenantId },
      relations: [
        'creator',
        'recipients',
        'recipients.recipient',
        'categoryAssignments',
        'categoryAssignments.category',
      ],
    });
  }

  async insertShoutout(
    manager: EntityManager,
    data: {
      tenantId: string;
      createdBy: string;
      message: string;
      totalPoints: number;
      recipientIds: string[];
      pointsPerRecipient: number;
      categoryIds: string[];
    },
  ): Promise<Shoutout> {
    const shoutout = manager.create(Shoutout, {
      tenantId: data.tenantId,
      createdBy: data.createdBy,
      message: data.message,
      totalPoints: data.totalPoints,
    });
    const saved = await manager.save(shoutout);

    const recipients = data.recipientIds.map((recipientId) =>
      manager.create(ShoutoutRecipient, {
        tenantId: data.tenantId,
        shoutoutId: saved.id,
        recipientId,
        points: data.pointsPerRecipient,
      }),
    );
    await manager.save(recipients);

    if (data.categoryIds.length > 0) {
      const assignments = data.categoryIds.map((categoryId) =>
        manager.create(ShoutoutCategoryAssignment, {
          tenantId: data.tenantId,
          shoutoutId: saved.id,
          categoryId,
        }),
      );
      await manager.save(assignments);
    }

    return saved;
  }
}
