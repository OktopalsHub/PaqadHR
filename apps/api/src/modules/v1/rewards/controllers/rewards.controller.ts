import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentTenantMember } from 'src/common/decorators';
import type { MemberContext } from 'src/common/interfaces';
import { MemberPointsService } from '../../shoutouts/services/member-points.service';
import { TenantMemberGuard } from '../../tenant-members/guards/tenant-members.guards';
import { WalletAutoTopupDto } from '../dto/wallet-auto-topup.dto';
import { CustomRewardsService } from '../services/custom-rewards.service';
import { RewardsService } from '../services/rewards.service';
import { TenantWalletService } from '../services/tenant-wallet.service';
import { TenantWalletTopupService } from '../services/tenant-wallet-topup.service';
import {
  RewardsAdminRoles,
  RewardsAllRoles,
  RewardsIntegrationsAdminRoles,
  RewardsIntegrationsAllRoles,
} from './rewards.decorators';
import { RewardsCatalogHandler } from './rewards-catalog.controller';
import { RewardsClaimsHandler } from './rewards-claims.controller';
import { RewardsTasksHandler } from './rewards-tasks.controller';
import { RewardsWalletHandler } from './rewards-wallet.controller';

@ApiTags('Rewards')
@Controller('tenants/:tenantId/rewards')
@UseGuards(TenantMemberGuard)
export class RewardsController {
  private readonly claims: RewardsClaimsHandler;
  private readonly wallet: RewardsWalletHandler;
  private readonly catalog: RewardsCatalogHandler;
  private readonly tasks: RewardsTasksHandler;

  constructor(
    rewardsService: RewardsService,
    walletService: TenantWalletService,
    walletTopupService: TenantWalletTopupService,
    customRewardsService: CustomRewardsService,
    memberPointsService: MemberPointsService,
  ) {
    this.claims = new RewardsClaimsHandler(rewardsService);
    this.wallet = new RewardsWalletHandler(rewardsService, walletService, walletTopupService);
    this.catalog = new RewardsCatalogHandler(rewardsService, customRewardsService);
    this.tasks = new RewardsTasksHandler(rewardsService, memberPointsService);
  }

  @Get('catalog')
  @RewardsIntegrationsAllRoles()
  async getCatalog(
    @Param('tenantId') t: string,
    @CurrentTenantMember() m: MemberContext,
    @Query('country') c?: string,
  ) {
    return this.catalog.getCatalog(t, m, c);
  }

  @Post('catalog/sync')
  @RewardsIntegrationsAdminRoles()
  async syncCatalog(@Param('tenantId') t: string) {
    return this.catalog.syncCatalog(t);
  }

  @Get('countries')
  @RewardsIntegrationsAllRoles()
  async getCountries(@Param('tenantId') t: string) {
    return this.catalog.getCountries(t);
  }

  @Post('claim')
  @RewardsIntegrationsAllRoles()
  async claim(
    @Param('tenantId') t: string,
    @Body() b: {
      rewardType: string;
      rewardId: string;
      pointsCost: number;
      currencyValue: number;
      [key: string]: unknown;
    },
    @CurrentTenantMember() m: MemberContext,
  ) {
    return this.claims.claim(t, b as never, m);
  }

  @Get('claims/me')
  @RewardsIntegrationsAllRoles()
  async getMyClaims(@Param('tenantId') t: string, @CurrentTenantMember() m: MemberContext) {
    return this.claims.getMyClaims(t, m);
  }

  @Get('claims')
  @RewardsIntegrationsAdminRoles()
  async getAllClaims(@Param('tenantId') t: string) {
    return this.claims.getAllClaims(t);
  }

  @Get('calculate-points')
  @RewardsIntegrationsAllRoles()
  async calculatePointsCost(
    @Param('tenantId') t: string,
    @Query('type') type: string,
    @Query('billerId') bid?: string,
    @Query('amount') amt?: string,
  ) {
    return this.claims.calculatePointsCost(t, type, bid, amt);
  }

  @Get('custom')
  @RewardsIntegrationsAdminRoles()
  async listCustomRewards(@Param('tenantId') t: string) {
    return this.catalog.listCustomRewards(t);
  }

  @Post('custom')
  @RewardsIntegrationsAdminRoles()
  async createCustomReward(
    @Param('tenantId') t: string,
    @Body() b: { name: string; pointsCost: number; [key: string]: unknown },
    @CurrentTenantMember() m: MemberContext,
  ) {
    return this.catalog.createCustomReward(t, b, m);
  }

  @Patch('custom/:rewardId')
  @RewardsIntegrationsAdminRoles()
  async updateCustomReward(
    @Param('tenantId') t: string,
    @Param('rewardId') r: string,
    @Body() b: { [key: string]: unknown },
    @CurrentTenantMember() m: MemberContext,
  ) {
    return this.catalog.updateCustomReward(t, r, b, m);
  }

  @Delete('custom/:rewardId')
  @RewardsIntegrationsAdminRoles()
  async deleteCustomReward(
    @Param('tenantId') t: string,
    @Param('rewardId') r: string,
    @CurrentTenantMember() m: MemberContext,
  ) {
    return this.catalog.deleteCustomReward(t, r, m);
  }

  @Get('providers')
  @RewardsIntegrationsAllRoles()
  async getProviderAvailability() {
    return this.catalog.getProviderAvailability();
  }

  @Get('data-plans/:network')
  @RewardsIntegrationsAllRoles()
  async listNombaDataPlans(@Param('network') n: string) {
    return this.catalog.listNombaDataPlans(n);
  }

  @Get('utilities/billers/:countryCode')
  @RewardsIntegrationsAllRoles()
  async listUtilityBillers(@Param('countryCode') c: string) {
    return this.catalog.listUtilityBillers(c);
  }

  @Post('utilities/lookup')
  @RewardsIntegrationsAllRoles()
  async lookupUtilityMeter(
    @Body() b: {
      countryCode: string;
      billerId: string;
      accountNumber: string;
      serviceType?: string;
    },
  ) {
    return this.catalog.lookupUtilityMeter(b);
  }

  @Get('wallet')
  @RewardsIntegrationsAdminRoles()
  async getWallet(@Param('tenantId') t: string) {
    return this.wallet.getWallet(t);
  }

  @Get('wallet/transactions')
  @RewardsIntegrationsAdminRoles()
  async getWalletTransactions(@Param('tenantId') t: string) {
    return this.wallet.getWalletTransactions(t);
  }

  @Post('wallet/topup')
  @RewardsIntegrationsAdminRoles()
  async manualTopup(
    @Param('tenantId') t: string,
    @Body() b: { amount: number },
    @CurrentTenantMember() m: MemberContext,
  ) {
    return this.wallet.manualTopup(t, b, m);
  }

  @Post('wallet/topup/checkout')
  @RewardsIntegrationsAdminRoles()
  async topupCheckout(
    @Param('tenantId') t: string,
    @Body() b: { amount: number },
    @CurrentTenantMember() m: MemberContext,
  ) {
    return this.wallet.topupCheckout(t, b, m);
  }

  @Post('wallet/topup/checkout/complete')
  @RewardsIntegrationsAdminRoles()
  async completeTopupCheckout(
    @Param('tenantId') t: string,
    @Body() b: { orderReference: string; amount?: number; transactionReference?: string },
    @CurrentTenantMember() m: MemberContext,
  ) {
    return this.wallet.completeTopupCheckout(t, b, m);
  }

  @Post('wallet/auto-topup')
  @RewardsIntegrationsAdminRoles()
  async updateAutoTopup(
    @Param('tenantId') t: string,
    @Body() b: WalletAutoTopupDto,
    @CurrentTenantMember() m: MemberContext,
  ) {
    return this.wallet.updateAutoTopup(t, b, m);
  }

  @Post('assign-points')
  @RewardsAdminRoles()
  async assignPoints(
    @Param('tenantId') t: string,
    @Body() b: { memberIds?: string[]; points?: number; reason?: string; assignments?: unknown },
    @CurrentTenantMember() m: MemberContext,
  ) {
    return this.tasks.assignPoints(t, b as never, m);
  }

  @Get('tasks')
  @RewardsAllRoles()
  async listTasks(@Param('tenantId') t: string, @CurrentTenantMember() m: MemberContext) {
    return this.tasks.listTasks(t, m);
  }

  @Get('tasks/submissions/pending')
  @RewardsAdminRoles()
  async listPendingSubmissions(
    @Param('tenantId') t: string,
    @CurrentTenantMember() m: MemberContext,
  ) {
    return this.tasks.listPendingSubmissions(t, m);
  }

  @Post('tasks')
  @RewardsAdminRoles()
  async createTask(
    @Param('tenantId') t: string,
    @Body() b: {
      title: string;
      description: string;
      points: number;
      icon: string;
      category?: string;
      imageUrl?: string;
      submissionType: 'instant' | 'text' | 'file';
      isRecurring?: boolean;
    },
    @CurrentTenantMember() m: MemberContext,
  ) {
    return this.tasks.createTask(t, b, m);
  }

  @Patch('tasks/:taskId')
  @RewardsAdminRoles()
  async updateTask(
    @Param('tenantId') t: string,
    @Param('taskId') id: string,
    @Body() b: { [key: string]: unknown },
    @CurrentTenantMember() m: MemberContext,
  ) {
    return this.tasks.updateTask(t, id, b, m);
  }

  @Delete('tasks/:taskId')
  @RewardsAdminRoles()
  async deleteTask(
    @Param('tenantId') t: string,
    @Param('taskId') id: string,
    @CurrentTenantMember() m: MemberContext,
  ) {
    return this.tasks.deleteTask(t, id, m);
  }

  @Post('tasks/:taskId/submit')
  @RewardsAllRoles()
  async submitTask(
    @Param('tenantId') t: string,
    @Param('taskId') id: string,
    @CurrentTenantMember() m: MemberContext,
    @Body() b: { submissionText?: string; submissionFileName?: string },
  ) {
    return this.tasks.submitTask(t, id, m, b);
  }

  @Post('tasks/:taskId/submissions/:submissionId/approve')
  @RewardsAdminRoles()
  async approveSubmission(
    @Param('tenantId') t: string,
    @Param('taskId') tid: string,
    @Param('submissionId') sid: string,
    @CurrentTenantMember() m: MemberContext,
  ) {
    return this.tasks.approveSubmission(t, tid, sid, m);
  }

  @Post('tasks/:taskId/submissions/:submissionId/reject')
  @RewardsAdminRoles()
  async rejectSubmission(
    @Param('tenantId') t: string,
    @Param('taskId') tid: string,
    @Param('submissionId') sid: string,
    @CurrentTenantMember() m: MemberContext,
  ) {
    return this.tasks.rejectSubmission(t, tid, sid, m);
  }
}
