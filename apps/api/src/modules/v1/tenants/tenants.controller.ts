import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { defaultPayrollCurrency, getNombaPayoutCurrencies } from 'src/common/config/nomba.config';
import { AuthOnly, CurrentUser, Public } from 'src/common/decorators';
import type { PaginationDto } from 'src/common/dto/pagination.dto';
import { TenantMemberRole, UserRole } from 'src/common/enums';
import { Roles as PlatformRoles } from 'src/common/guards/role.guard';
import { Roles, TenantRoleGuard } from 'src/common/guards/tenant-member-role.guard';
import type { IAuthenticatedUserRequest } from 'src/common/interfaces';
import type { IPaginatedData } from 'src/common/interfaces/pagination.interface';
import { FileUrlService } from 'src/common/services/file-url.service';
import { getPaginationSummary } from 'src/common/utils/pagination.util';
import { TenantMemberGuard } from '../tenant-members/guards/tenant-members.guards';
import type { CreateTenantDto } from './dto/create-tenant.dto';
import { TenantResponseDto, type UserTenantWithMembershipDto } from './dto/tenant-response.dto';
import type { UpdateTenantDto } from './dto/update-tenant.dto';
import { TenantsService } from './tenants.service';

@ApiTags('Tenants')
@Controller('tenants')
export class TenantsController {
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly fileUrlService: FileUrlService,
  ) {}
  @Post()
  @AuthOnly()
  async createTenant(
    @Body() createTenantDto: CreateTenantDto,
    @CurrentUser() req: IAuthenticatedUserRequest,
  ) {
    return this.tenantsService.createTenant(req.auth.principalId, createTenantDto);
  }
  @Get()
  @AuthOnly()
  @PlatformRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async getTenant(@Param('tenantId', ParseUUIDPipe) tenantId: string) {
    const tenant = await this.tenantsService.getTenant(tenantId);
    return TenantResponseDto.toResponse(tenant, this.fileUrlService);
  }
  @Patch(':tenantId')
  @UseGuards(TenantMemberGuard, TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async updateTenant(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() updateTenantDto: UpdateTenantDto,
  ) {
    return this.tenantsService.updateTenant(tenantId, updateTenantDto);
  }
  @Delete(':tenantId')
  @UseGuards(TenantMemberGuard)
  @HttpCode(204)
  async deleteTenant(@Param('tenantId', ParseUUIDPipe) tenantId: string) {
    await this.tenantsService.deleteTenant(tenantId);
  }
  @Patch(':tenantId/restore')
  @UseGuards(TenantMemberGuard)
  async restoreTenant(@Param('tenantId', ParseUUIDPipe) tenantId: string) {
    return this.tenantsService.restoreTenant(tenantId);
  }
  @Get('user/me')
  @AuthOnly()
  async getUserTenants(
    @CurrentUser() req: IAuthenticatedUserRequest,
    @Query() pagination: PaginationDto,
  ): Promise<IPaginatedData<UserTenantWithMembershipDto>> {
    const result = await this.tenantsService.getUserTenantsWithDetails(req.auth.principalId);
    const { page = 1, limit = 10 } = pagination;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedTenants = result.tenants.slice(startIndex, endIndex);
    const tenantsWithMembership: UserTenantWithMembershipDto[] = paginatedTenants.map((tenant) => {
      const response: UserTenantWithMembershipDto = {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        isActive: tenant.isActive,
        inviteCode: tenant.inviteCode,
        employeeCode: tenant.employeeCode || undefined,
        industry: tenant.industry || undefined,
        companySize: tenant.companySize || undefined,
        location: tenant.location || undefined,
        logoUrl:
          tenant.logoKey && tenant.id
            ? this.fileUrlService.getTenantLogoUrl(tenant.id, tenant.logoKey) || undefined
            : undefined,
        countryCode: tenant.countryCode || undefined,
        timezone: tenant.timezone,
        preferredCurrency: tenant.preferredCurrency || undefined,
        member: {
          id: tenant.membership!.id,
          firstName: tenant.membership!.firstName || undefined,
          lastName: tenant.membership!.lastName || undefined,
          middleName: tenant.membership!.middleName || undefined,
          preferredName: tenant.membership!.preferredName || undefined,
          phone: tenant.membership!.phone || undefined,
          dateOfBirth: tenant.membership!.dateOfBirth
            ? (typeof tenant.membership!.dateOfBirth === 'string'
                ? new Date(tenant.membership!.dateOfBirth)
                : tenant.membership!.dateOfBirth
              ).toISOString()
            : undefined,
          gender: tenant.membership!.gender || undefined,
          role: tenant.membership!.role,
          employeeNumber: tenant.membership!.employeeNumber || undefined,
          isActive: tenant.membership!.isActive,
          joinDate: tenant.membership!.joinDate.toISOString(),
          leaveDate: tenant.membership!.leaveDate?.toISOString(),
          avatarUrl:
            tenant.membership!.avatarKey && tenant.id
              ? this.fileUrlService.getMemberAvatarUrl(tenant.id, tenant.membership!.avatarKey) ||
                undefined
              : undefined,
        },
      };
      return response;
    });
    return getPaginationSummary(
      tenantsWithMembership,
      result.totalCount,
      { page, limit },
      'User Tenants',
    );
  }
  @Public()
  @Get('slug/:slug')
  async getTenantBySlug(@Param('slug') slug: string) {
    if (!/^[a-zA-Z0-9_-]+$/.test(slug) || slug.length > 50) {
      throw new BadRequestException('Invalid slug format');
    }
    return this.tenantsService.getTenantBySlug(slug);
  }
  @Patch(':tenantId/payment-currency')
  @UseGuards(TenantMemberGuard)
  async updatePaymentCurrency(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() body: { currency: string },
  ) {
    const supportedCurrencies = [...getNombaPayoutCurrencies()];
    if (!supportedCurrencies.includes(body.currency.toUpperCase())) {
      throw new BadRequestException(`Currency must be one of: ${supportedCurrencies.join(', ')}`);
    }
    const updateDto: UpdateTenantDto = {
      preferredCurrency: body.currency,
    };
    return this.tenantsService.updateTenant(tenantId, updateDto);
  }
  @Get(':tenantId/payment-currency')
  @UseGuards(TenantMemberGuard)
  async getPaymentCurrency(@Param('tenantId', ParseUUIDPipe) tenantId: string) {
    const tenant = await this.tenantsService.getTenant(tenantId);
    return {
      currency: tenant.preferredCurrency || defaultPayrollCurrency(),
      supportedCurrencies: [...getNombaPayoutCurrencies()],
    };
  }
  @Get(':tenantId/profile')
  @UseGuards(TenantMemberGuard)
  async getTenantProfile(@Param('tenantId', ParseUUIDPipe) tenantId: string) {
    const tenant = await this.tenantsService.getTenant(tenantId);
    return TenantResponseDto.toResponse(tenant, this.fileUrlService);
  }
}
