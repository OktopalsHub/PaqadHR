import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ActivitiesService } from '../../activities/services/activities.service';
import type { CreateShoutoutCategoryDto } from '../dto/create-shoutout-category.dto';
import type { UpdateShoutoutCategoryDto } from '../dto/update-shoutout-category.dto';
import { ShoutoutCategoriesRepository } from '../repositories/shoutout-categories.repository';

@Injectable()
export class ShoutoutCategoriesService {
  constructor(
    private readonly categoriesRepository: ShoutoutCategoriesRepository,
    private readonly activitiesService: ActivitiesService,
  ) {}

  async listCategories(tenantId: string) {
    return this.categoriesRepository.listByTenant(tenantId);
  }

  async createCategory(tenantId: string, dto: CreateShoutoutCategoryDto, actorMemberId?: string) {
    const category = this.categoriesRepository.create({
      tenantId,
      name: dto.name,
      description: dto.description ?? null,
      color: dto.color ?? null,
      isActive: dto.isActive ?? true,
    });
    const saved = await this.categoriesRepository.save(category);

    if (actorMemberId) {
      void this.activitiesService
        .queueActivity({
          tenantId,
          actorMemberId,
          action: 'shoutout.category_created',
          resourceType: 'shoutout_category',
          resourceId: saved.id,
          description: `Shoutout category "${dto.name}" created`,
          metadata: { name: dto.name },
        })
        .catch(() => {});
    }

    return saved;
  }

  async updateCategory(
    tenantId: string,
    id: string,
    dto: UpdateShoutoutCategoryDto,
    actorMemberId?: string,
  ) {
    const category = await this.categoriesRepository.getById(tenantId, id);
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    if (dto.name !== undefined) category.name = dto.name;
    if (dto.description !== undefined) category.description = dto.description;
    if (dto.color !== undefined) category.color = dto.color;
    if (dto.isActive !== undefined) category.isActive = dto.isActive;
    const saved = await this.categoriesRepository.save(category);

    if (actorMemberId) {
      void this.activitiesService
        .queueActivity({
          tenantId,
          actorMemberId,
          action: 'shoutout.category_updated',
          resourceType: 'shoutout_category',
          resourceId: id,
          description: `Shoutout category updated`,
          metadata: { updatedFields: Object.keys(dto) },
        })
        .catch(() => {});
    }

    return saved;
  }

  async deleteCategory(tenantId: string, id: string, actorMemberId?: string) {
    const category = await this.categoriesRepository.getById(tenantId, id);
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    category.isActive = false;
    const saved = await this.categoriesRepository.save(category);

    if (actorMemberId) {
      void this.activitiesService
        .queueActivity({
          tenantId,
          actorMemberId,
          action: 'shoutout.category_deleted',
          resourceType: 'shoutout_category',
          resourceId: id,
          description: `Shoutout category "${category.name}" deactivated`,
          metadata: { name: category.name },
        })
        .catch(() => {});
    }

    return saved;
  }

  async resolveCategoryIds(
    tenantId: string,
    categoryIds: string[] | undefined,
    enableCategories: boolean,
  ): Promise<string[]> {
    if (!enableCategories) {
      return categoryIds ?? [];
    }
    if (!categoryIds || categoryIds.length === 0) {
      throw new BadRequestException(
        'At least one category is required when categories are enabled',
      );
    }
    const categories = await this.categoriesRepository.listByIds(tenantId, categoryIds);
    if (categories.length !== categoryIds.length) {
      throw new BadRequestException('One or more categories are invalid');
    }
    return categoryIds;
  }

  async getDefaultCategoryId(tenantId: string): Promise<string | null> {
    const category = await this.categoriesRepository.getFirstActive(tenantId);
    return category?.id ?? null;
  }
}
