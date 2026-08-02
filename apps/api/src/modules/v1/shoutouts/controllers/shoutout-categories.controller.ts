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
import { RequireFeatures } from 'src/common/decorators/feature-access.decorator';
import { TenantMemberRole } from 'src/common/enums';
import { FeatureAccess } from 'src/common/enums/subscription.enum';
import { Roles, TenantRoleGuard } from 'src/common/guards/tenant-member-role.guard';
import { TenantMemberGuard } from '../../tenant-members/guards/tenant-members.guards';
import { CreateShoutoutCategoryDto } from '../dto/create-shoutout-category.dto';
import { ShoutoutCategoryResponseDto } from '../dto/shoutout-category-response.dto';
import { UpdateShoutoutCategoryDto } from '../dto/update-shoutout-category.dto';
import { ShoutoutCategoriesService } from '../services/shoutout-categories.service';

@ApiTags('Shoutouts')
@UseGuards(TenantMemberGuard)
@RequireFeatures(FeatureAccess.INTEGRATIONS)
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
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  @ApiOperation({ summary: 'Create a shoutout category' })
  @ApiResponse({ status: HttpStatus.CREATED, type: ShoutoutCategoryResponseDto })
  async createCategory(@TenantId() tenantId: string, @Body() dto: CreateShoutoutCategoryDto) {
    return this.categoriesService.createCategory(tenantId, dto);
  }

  @Patch(':id')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
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
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  @ApiOperation({ summary: 'Deactivate a shoutout category' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  async deleteCategory(@TenantId() tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    await this.categoriesService.deleteCategory(tenantId, id);
  }
}
