import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateShoutoutCategoryDto } from '../dto/create-shoutout-category.dto';
import { UpdateShoutoutCategoryDto } from '../dto/update-shoutout-category.dto';
import { ShoutoutCategoriesRepository } from '../repositories/shoutout-categories.repository';

@Injectable()
export class ShoutoutCategoriesService {
  constructor(
    private readonly categoriesRepository: ShoutoutCategoriesRepository,
  ) {}

  async listCategories(tenantId: string) {
    return this.categoriesRepository.listByTenant(tenantId);
  }

  async createCategory(tenantId: string, dto: CreateShoutoutCategoryDto) {
    const category = this.categoriesRepository.create({
      tenantId,
      name: dto.name,
      description: dto.description ?? null,
      color: dto.color ?? null,
      isActive: dto.isActive ?? true,
    });
    return this.categoriesRepository.save(category);
  }

  async updateCategory(
    tenantId: string,
    id: string,
    dto: UpdateShoutoutCategoryDto,
  ) {
    const category = await this.categoriesRepository.getById(tenantId, id);
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    if (dto.name !== undefined) category.name = dto.name;
    if (dto.description !== undefined) category.description = dto.description;
    if (dto.color !== undefined) category.color = dto.color;
    if (dto.isActive !== undefined) category.isActive = dto.isActive;
    return this.categoriesRepository.save(category);
  }

  async deleteCategory(tenantId: string, id: string) {
    const category = await this.categoriesRepository.getById(tenantId, id);
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    category.isActive = false;
    return this.categoriesRepository.save(category);
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
    const categories = await this.categoriesRepository.listByIds(
      tenantId,
      categoryIds,
    );
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
