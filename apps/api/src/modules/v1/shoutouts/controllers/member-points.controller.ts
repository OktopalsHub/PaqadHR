import { Controller, Get, HttpStatus, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentTenantMember, TenantId } from 'src/common/decorators';
import type { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import type { MemberContext } from 'src/common/interfaces';
import { PaginationUtil } from 'src/common/utils/pagination.util';
import { TenantMemberGuard } from '../../tenant-members/guards/tenant-members.guards';
import {
  MemberPointsBalanceDto,
  MemberPointsTransactionPaginatedResponseDto,
} from '../dto/member-points-response.dto';
import { MemberPointsService } from '../services/member-points.service';

@ApiTags('member-points')
@UseGuards(TenantMemberGuard)
@Controller('tenants/:tenantId/member-points')
export class MemberPointsController {
  constructor(private readonly memberPointsService: MemberPointsService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current member points balance' })
  @ApiResponse({ status: HttpStatus.OK, type: MemberPointsBalanceDto })
  async getMyBalance(@TenantId() tenantId: string, @CurrentTenantMember() member: MemberContext) {
    return this.memberPointsService.getBalance(tenantId, member.id);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'List current member point transactions' })
  @ApiResponse({ status: HttpStatus.OK, type: MemberPointsTransactionPaginatedResponseDto })
  async listMyTransactions(
    @TenantId() tenantId: string,
    @CurrentTenantMember() member: MemberContext,
    @Query() query: PaginationQueryDto,
  ) {
    const { page, limit } = PaginationUtil.parsePaginationOptions(query);
    return this.memberPointsService.listTransactions(tenantId, member.id, page, limit);
  }
}
