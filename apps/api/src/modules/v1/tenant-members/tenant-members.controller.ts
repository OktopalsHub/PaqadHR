import { Body, Controller, Delete, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators';
import { TenantMemberRole } from 'src/common/enums';
import { TenantRoleGuard } from 'src/common/guards/tenant-member-role.guard';
import type { IAuthenticatedUserRequest } from 'src/common/interfaces';
import { FileUrlService } from 'src/common/services/file-url.service';
import { Public } from '../../../common/decorators';
import type { ICelebrationResponseDto } from '../../../common/interfaces/icelebration-response-dto.interface';
import type { INewHiresResponseDto } from '../../../common/interfaces/inew-hires-response-dto.interface';
import type { ITenantMemberResponseDto } from '../../../common/interfaces/itenant-member-response-dto.interface';
import { TenantMemberMapper, TenantMemberResponseDto } from './dto/tenant-member-response.dto';
import type { UpdateTenantMemberDto } from './dto/update-tenant-member.dto';
import type { UpdateTenantMemberStatusDto } from './dto/update-tenant-member-status.dto';
import { TenantMemberGuard } from './guards/tenant-members.guards';
import { TenantMembersService } from './tenant-members.service';

@ApiTags('Tenant Members')
@Controller('tenants/:tenantId')
@UseGuards(TenantMemberGuard)
export class TenantMembersController {
  constructor(
    private readonly tenantMembersService: TenantMembersService,
    private readonly fileUrlService: FileUrlService,
  ) {}
  @Get('members')
  @ApiOperation({
    summary: 'Get all tenant members with department information',
    description:
      'Returns a list of tenant members including their department, position, and user information',
  })
  @ApiResponse({
    status: 200,
    description: 'Tenant members retrieved successfully',
    type: [TenantMemberResponseDto],
  })
  async getTenantMembers(@Param('tenantId') tenantId: string): Promise<ITenantMemberResponseDto[]> {
    const tenantMembers = await this.tenantMembersService.getTenantMembers(tenantId);
    return TenantMemberMapper.toResponseList(tenantMembers, this.fileUrlService);
  }
  @Get('profile')
  async getTenantMemberProfile(
    @Param('tenantId') tenantId: string,
    @CurrentUser() req: IAuthenticatedUserRequest,
  ): Promise<ITenantMemberResponseDto> {
    const member = await this.tenantMembersService.getTenantMemberProfile(
      req.auth.principalId,
      tenantId,
    );
    return TenantMemberMapper.toResponse(member, this.fileUrlService);
  }
  @Get('roles')
  @Public()
  getTenantMemberRoles() {
    const roles = Object.values(TenantMemberRole).filter((role) => role !== TenantMemberRole.OWNER);
    return roles.map((role) => ({
      value: role,
      label: role.charAt(0).toUpperCase() + role.slice(1),
    }));
  }
  @Get('/members/:memberId')
  @UseGuards(TenantRoleGuard)
  async getTenantMember(
    @Param('tenantId') tenantId: string,
    @Param('memberId') memberId: string,
  ): Promise<ITenantMemberResponseDto> {
    const result = await this.tenantMembersService.getTenantMember(memberId, tenantId);
    return TenantMemberMapper.toResponse(result, this.fileUrlService);
  }
  @Delete('/members/:memberId')
  @UseGuards(TenantRoleGuard)
  async removeTenantMember(
    @Param('tenantId') tenantId: string,
    @Param('memberId') memberId: string,
  ): Promise<void> {
    await this.tenantMembersService.removeTenantMember(memberId, tenantId);
  }
  @Patch('/members/:memberId/status')
  @UseGuards(TenantRoleGuard)
  async updateTenantMemberStatus(
    @Param('tenantId') tenantId: string,
    @Param('memberId') memberId: string,
    @Body() updateDto: UpdateTenantMemberStatusDto,
  ) {
    const updatedMember = await this.tenantMembersService.updateTenantMemberStatus(
      memberId,
      tenantId,
      updateDto.isActive,
    );
    return TenantMemberMapper.toResponse(updatedMember, this.fileUrlService);
  }
  @Patch('/members/:memberId')
  @UseGuards(TenantRoleGuard)
  @ApiOperation({
    summary: 'Update tenant member details',
    description: 'Update tenant member information such as department and reports to',
  })
  @ApiResponse({
    status: 200,
    description: 'Tenant member updated successfully',
    type: TenantMemberResponseDto,
  })
  async updateTenantMember(
    @Param('tenantId') tenantId: string,
    @Param('memberId') memberId: string,
    @Body() updateDto: UpdateTenantMemberDto,
  ): Promise<ITenantMemberResponseDto> {
    const updatedMember = await this.tenantMembersService.updateTenantMemberById(
      memberId,
      tenantId,
      updateDto,
    );
    return TenantMemberMapper.toResponse(updatedMember, this.fileUrlService);
  }
  @Get('new-hires')
  @ApiOperation({
    summary: 'Get new hires for the tenant',
    description: 'Returns a list of new hires within the last 2 months',
  })
  @ApiResponse({
    status: 200,
    description: 'New hires retrieved successfully',
    type: [Object],
  })
  async getNewHires(@Param('tenantId') tenantId: string): Promise<INewHiresResponseDto[]> {
    return this.tenantMembersService.getNewHires(tenantId);
  }
  @Get('celebrations')
  @ApiOperation({
    summary: 'Get upcoming celebrations for the tenant',
    description:
      'Returns employees with birthdays and work anniversaries for current month and next 2 months',
  })
  @ApiResponse({
    status: 200,
    description: 'Celebrations retrieved successfully',
    type: [Object],
  })
  async getCelebrations(@Param('tenantId') tenantId: string): Promise<ICelebrationResponseDto[]> {
    return this.tenantMembersService.getUpcomingCelebrations(tenantId);
  }
}
