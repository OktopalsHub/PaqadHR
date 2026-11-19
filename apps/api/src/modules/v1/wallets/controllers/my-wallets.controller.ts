import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { RateLimit, RateLimitPresets, SkipMember } from '../../../../common/decorators';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import type { IAuthenticatedUserRequest } from '../../../../common/interfaces/authenticated-user.interface';
import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';
import { User } from '../../users/entities/user.entity';
import { CreateBridgeVirtualAccountDto } from '../dto/create-bridge-virtual-account.dto';
import { CreateBridgeWalletDto } from '../dto/create-bridge-wallet.dto';
import { LinkBridgeExternalAccountDto } from '../dto/link-bridge-external-account.dto';
import { StartEmployeeBridgeOnboardingDto } from '../dto/start-employee-bridge-onboarding.dto';
import { BridgeWalletService } from '../services/bridge-wallet.service';

@ApiTags('Employee wallet')
@Controller('wallets/me/bridge')
@UseGuards(JwtAuthGuard)
@SkipMember()
export class MyWalletsController {
  constructor(
    private readonly bridgeWallets: BridgeWalletService,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(TenantMember) private readonly memberRepository: Repository<TenantMember>,
  ) {}

  @Post('onboarding')
  @RateLimit(RateLimitPresets.SENSITIVE)
  async startOnboarding(
    @Body() dto: StartEmployeeBridgeOnboardingDto,
    @Req() request: IAuthenticatedUserRequest,
  ) {
    const user = await this.userRepository.findOne({
      where: { id: request.auth.principalId },
      select: { id: true, email: true, emailVerified: true },
    });
    if (!user) throw new NotFoundException('Authenticated user was not found.');
    if (!user.emailVerified)
      throw new BadRequestException('Verify your account email before Bridge onboarding.');
    return this.bridgeWallets.createOnboardingLink({
      owner: { ownerType: 'employee', tenantId: null, userId: user.id },
      fullName: dto.fullName,
      email: user.email,
    });
  }

  @Get('onboarding')
  @RateLimit(RateLimitPresets.SENSITIVE)
  async getOnboardingStatus(@Req() request: IAuthenticatedUserRequest) {
    return this.bridgeWallets.refreshCustomerStatus({
      ownerType: 'employee',
      tenantId: null,
      userId: request.auth.principalId,
    });
  }

  @Post()
  @RateLimit(RateLimitPresets.SENSITIVE)
  async createWallet(
    @Body() dto: CreateBridgeWalletDto,
    @Req() request: IAuthenticatedUserRequest,
  ) {
    const user = await this.userRepository.findOne({
      where: { id: request.auth.principalId },
      select: { id: true, countryCode: true },
    });
    if (!user) throw new NotFoundException('Authenticated user was not found.');
    if (!user.countryCode)
      throw new BadRequestException('Set a personal country before creating an employee wallet.');
    return this.bridgeWallets.createWallet({
      owner: { ownerType: 'employee', tenantId: null, userId: user.id },
      country: user.countryCode,
      currency: dto.currency,
      network: dto.network,
    });
  }

  @Get('balances')
  @RateLimit(RateLimitPresets.SENSITIVE)
  async getBalances(@Req() request: IAuthenticatedUserRequest) {
    return this.bridgeWallets.getWalletBalances({
      ownerType: 'employee',
      tenantId: null,
      userId: request.auth.principalId,
    });
  }

  @Post('virtual-accounts')
  @RateLimit(RateLimitPresets.SENSITIVE)
  async createVirtualAccount(
    @Body() dto: CreateBridgeVirtualAccountDto,
    @Req() request: IAuthenticatedUserRequest,
  ) {
    const user = await this.userRepository.findOne({
      where: { id: request.auth.principalId },
      select: { id: true, countryCode: true },
    });
    if (!user) throw new NotFoundException('Authenticated user was not found.');
    if (!user.countryCode)
      throw new BadRequestException('Set a personal country before creating a deposit account.');
    return this.bridgeWallets.createVirtualAccount({
      owner: { ownerType: 'employee', tenantId: null, userId: user.id },
      country: user.countryCode,
      sourceCurrency: dto.sourceCurrency,
      destinationCurrency: dto.destinationCurrency,
      network: dto.network,
    });
  }

  @Get('virtual-accounts')
  @RateLimit(RateLimitPresets.SENSITIVE)
  async getVirtualAccounts(@Req() request: IAuthenticatedUserRequest) {
    return this.bridgeWallets.getVirtualAccounts({
      ownerType: 'employee',
      tenantId: null,
      userId: request.auth.principalId,
    });
  }

  @Post('external-accounts')
  @RateLimit(RateLimitPresets.SENSITIVE)
  async linkExternalAccount(
    @Body() dto: LinkBridgeExternalAccountDto,
    @Req() request: IAuthenticatedUserRequest,
  ) {
    const userId = request.auth.principalId;
    const [user, member] = await Promise.all([
      this.userRepository.findOne({
        where: { id: userId },
        select: { id: true, countryCode: true },
      }),
      this.memberRepository.findOne({
        where: { tenantId: dto.tenantId, userId },
        select: { id: true, tenantId: true, userId: true },
      }),
    ]);
    if (!user || !member) throw new NotFoundException('Employee payroll account was not found.');
    if (!user.countryCode) {
      throw new BadRequestException('Set a personal country before linking a Bridge bank account.');
    }
    return this.bridgeWallets.linkEmployeeExternalAccount({
      tenantId: dto.tenantId,
      memberId: member.id,
      userId,
      country: user.countryCode,
      paymentMethodId: dto.paymentMethodId,
      sourceCurrency: dto.sourceCurrency,
      network: dto.network,
    });
  }
}
