import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentTenantMember, TenantId } from 'src/common/decorators';
import type { MemberContext } from 'src/common/interfaces';
import { PaginationUtil } from 'src/common/utils/pagination.util';
import { TenantMemberGuard } from '../../tenant-members/guards/tenant-members.guards';
import type { CreateShoutoutDto } from '../dto/create-shoutout.dto';
import type { ListShoutoutsQueryDto } from '../dto/list-shoutouts-query.dto';
import { ShoutoutPaginatedResponseDto, ShoutoutResponseDto } from '../dto/shoutout-response.dto';
import { ShoutoutsService } from '../services/shoutouts.service';

@ApiTags('Shoutouts')
@UseGuards(TenantMemberGuard)
@Controller('tenants/:tenantId/shoutouts')
export class ShoutoutsController {
  constructor(private readonly shoutoutsService: ShoutoutsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a shoutout' })
  @ApiResponse({ status: HttpStatus.CREATED, type: ShoutoutResponseDto })
  async createShoutout(
    @TenantId() tenantId: string,
    @CurrentTenantMember() member: MemberContext,
    @Body() dto: CreateShoutoutDto,
  ) {
    return this.shoutoutsService.createShoutout(tenantId, member.id, {
      recipients: dto.recipients,
      message: dto.message,
      categoryIds: dto.categoryIds,
      source: 'api',
    });
  }

  @Get()
  @ApiOperation({ summary: 'List tenant shoutout feed' })
  @ApiResponse({ status: HttpStatus.OK, type: ShoutoutPaginatedResponseDto })
  async listShoutouts(@TenantId() tenantId: string, @Query() query: ListShoutoutsQueryDto) {
    const { page, limit } = PaginationUtil.parsePaginationOptions(query);
    return this.shoutoutsService.listShoutouts(tenantId, {
      page,
      limit,
      senderId: query.senderId,
      recipientId: query.recipientId,
      categoryIds: query.categoryIds ? query.categoryIds.split(',').filter(Boolean) : undefined,
    });
  }
}
