import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TenantId } from 'src/common/decorators';
import { TenantMemberGuard } from '../../tenant-members/guards/tenant-members.guards';
import type { CreateShoutoutCategoryDto } from '../dto/create-shoutout-category.dto';
import { ShoutoutCategoryResponseDto } from '../dto/shoutout-category-response.dto';
import type { UpdateShoutoutCategoryDto } from '../dto/update-shoutout-category.dto';
import type { ShoutoutCategoriesService } from '../services/shoutout-categories.service';

@ApiTags('shoutout-categories')
@UseGuards(TenantMemberGuard)
@Controller('tenants/:tenantId/shoutout-categories')
export class ShoutoutCategoriesController {
  constructor(private readonly categoriesService: ShoutoutCategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'List shoutout categories (core values)' })
  @ApiResponse({ status: HttpStatus.OK, type: [ShoutoutCategoryResponseDto] })
  async listCategories(@TenantId() tenantId: string) {
    return this.categoriesService.listCategories(tenantId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a shoutout category' })
  @ApiResponse({ status: HttpStatus.CREATED, type: ShoutoutCategoryResponseDto })
  async createCategory(@TenantId() tenantId: string, @Body() dto: CreateShoutoutCategoryDto) {
    return this.categoriesService.createCategory(tenantId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a shoutout category' })
  @ApiResponse({ status: HttpStatus.OK, type: ShoutoutCategoryResponseDto })
  async updateCategory(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateShoutoutCategoryDto,
  ) {
    return this.categoriesService.updateCategory(tenantId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deactivate a shoutout category' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  async deleteCategory(@TenantId() tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    await this.categoriesService.deleteCategory(tenantId, id);
  }
}
