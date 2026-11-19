import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { RateLimit, RateLimitPresets, RequireFeatures } from '../../../../common/decorators';
import { FeatureAccess, TenantMemberRole } from '../../../../common/enums';
import { Roles, TenantRoleGuard } from '../../../../common/guards/tenant-member-role.guard';
import type { IAuthenticatedMemberRequest } from '../../../../common/interfaces/authenticated-member.interface';
import { TenantMemberGuard } from '../../tenant-members/guards/tenant-members.guards';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { User } from '../../users/entities/user.entity';
import { CreateBridgeVirtualAccountDto } from '../dto/create-bridge-virtual-account.dto';
import { CreateBridgeWalletDto } from '../dto/create-bridge-wallet.dto';
import { StartOrganizationBridgeOnboardingDto } from '../dto/start-organization-bridge-onboarding.dto';
import { BridgeWalletService } from '../services/bridge-wallet.service';

@ApiTags('Payroll wallets')
@Controller('tenants/:tenantId/payroll')
@UseGuards(TenantMemberGuard, TenantRoleGuard)
@RequireFeatures(FeatureAccess.PAYROLL)
export class WalletsController {
  constructor(
    private readonly bridgeWallets: BridgeWalletService,
    @InjectRepository(Tenant) private readonly tenantRepository: Repository<Tenant>,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
  ) {}

  @Post('wallets/bridge/onboarding')
  @RateLimit(RateLimitPresets.SENSITIVE)
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async startOrganizationOnboarding(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() dto: StartOrganizationBridgeOnboardingDto,
    @Req() request: IAuthenticatedMemberRequest,
  ) {
    const [tenant, user] = await Promise.all([
      this.tenantRepository.findOne({
        where: { id: tenantId },
        select: { id: true },
      }),
      this.userRepository.findOne({
        where: { id: request.auth.principalId },
        select: { id: true, email: true, emailVerified: true },
      }),
    ]);
    if (!tenant || !user)
      throw new NotFoundException('Organization or authenticated user was not found.');
    if (!user.emailVerified)
      throw new BadRequestException('Verify your account email before Bridge onboarding.');
    return this.bridgeWallets.createOnboardingLink({
      owner: { ownerType: 'organization', tenantId, userId: null },
      fullName: dto.legalBusinessName,
      email: user.email,
    });
  }

  @Get('wallets/bridge/onboarding')
  @RateLimit(RateLimitPresets.SENSITIVE)
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async getOrganizationOnboardingStatus(@Param('tenantId', ParseUUIDPipe) tenantId: string) {
    return this.bridgeWallets.refreshCustomerStatus({
      ownerType: 'organization',
      tenantId,
      userId: null,
    });
  }

  @Post('wallets/bridge')
  @RateLimit(RateLimitPresets.SENSITIVE)
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async createOrganizationWallet(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() dto: CreateBridgeWalletDto,
  ) {
    const tenant = await this.tenantRepository.findOne({
      where: { id: tenantId },
      select: { id: true, countryCode: true },
    });
    if (!tenant) throw new NotFoundException('Organization was not found.');
    if (!tenant.countryCode)
      throw new BadRequestException(
        'Set an organization country before creating a payroll wallet.',
      );
    return this.bridgeWallets.createWallet({
      owner: { ownerType: 'organization', tenantId, userId: null },
      country: tenant.countryCode,
      currency: dto.currency,
      network: dto.network,
    });
  }

  @Get('wallets/bridge/balances')
  @RateLimit(RateLimitPresets.SENSITIVE)
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async getOrganizationBalances(@Param('tenantId', ParseUUIDPipe) tenantId: string) {
    return this.bridgeWallets.getWalletBalances({
      ownerType: 'organization',
      tenantId,
      userId: null,
    });
  }

  @Post('wallets/bridge/virtual-accounts')
  @RateLimit(RateLimitPresets.SENSITIVE)
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async createOrganizationVirtualAccount(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() dto: CreateBridgeVirtualAccountDto,
  ) {
    const tenant = await this.tenantRepository.findOne({
      where: { id: tenantId },
      select: { id: true, countryCode: true },
    });
    if (!tenant) throw new NotFoundException('Organization was not found.');
    if (!tenant.countryCode)
      throw new BadRequestException(
        'Set an organization country before creating a deposit account.',
      );
    return this.bridgeWallets.createVirtualAccount({
      owner: { ownerType: 'organization', tenantId, userId: null },
      country: tenant.countryCode,
      sourceCurrency: dto.sourceCurrency,
      destinationCurrency: dto.destinationCurrency,
      network: dto.network,
    });
  }

  @Get('wallets/bridge/virtual-accounts')
  @RateLimit(RateLimitPresets.SENSITIVE)
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async getOrganizationVirtualAccounts(@Param('tenantId', ParseUUIDPipe) tenantId: string) {
    return this.bridgeWallets.getVirtualAccounts({
      ownerType: 'organization',
      tenantId,
      userId: null,
    });
  }
}
