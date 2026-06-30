import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from 'src/common/decorators';
import { MemberPointsService } from '../../shoutouts/services/member-points.service';
import { CustomRewardsService } from '../services/custom-rewards.service';
import { type ClaimInput, RewardsService } from '../services/rewards.service';
import { TenantWalletService } from '../services/tenant-wallet.service';

@ApiTags('Rewards')
@Controller('tenants/:tenantId/rewards')
export class RewardsController {
  constructor(
    private readonly rewardsService: RewardsService,
    private readonly walletService: TenantWalletService,
    private readonly customRewardsService: CustomRewardsService,
    private readonly memberPointsService: MemberPointsService,
  ) {}

  @Post('webhooks/nomba')
  @Public()
  @HttpCode(HttpStatus.OK)
  async handleNombaWebhook(
    @Req() req: any,
    @Headers('nomba-signature') signature: string,
    @Headers('nomba-sig-value') signatureAlt: string,
    @Headers('x-nomba-signature') signatureLegacy: string,
  ) {
    const rawBody = req.rawBody?.toString('utf8') ?? '';
    return this.rewardsService.handleNombaFundingWebhook(
      rawBody,
      signature || signatureAlt || signatureLegacy || '',
    );
  }

  @Get('catalog')
  async getCatalog(@Param('tenantId') tenantId: string) {
    return this.rewardsService.getCatalog(tenantId);
  }

  @Get('countries')
  async getCountries(@Param('tenantId') tenantId: string) {
    return this.rewardsService.getReloadlyCountries(tenantId);
  }

  @Post('claim')
  async claim(@Param('tenantId') tenantId: string, @Body() body: ClaimInput, @Req() req: any) {
    const memberId = req.user?.memberId ?? req.user?.id;
    return this.rewardsService.claim(tenantId, memberId, body);
  }

  @Get('claims/me')
  async getMyClaims(@Param('tenantId') tenantId: string, @Req() req: any) {
    const memberId = req.user?.memberId ?? req.user?.id;
    return this.rewardsService.getMyClaims(tenantId, memberId);
  }

  @Get('claims')
  async getAllClaims(@Param('tenantId') tenantId: string) {
    return this.rewardsService.getAllClaims(tenantId);
  }

  @Get('wallet')
  async getWallet(@Param('tenantId') tenantId: string) {
    const wallet = await this.walletService.getWallet(tenantId);
    const fees = await this.rewardsService.getRedemptionFees(tenantId, wallet.currencyCode);
    return {
      ...wallet,
      feePercentage: fees.feePercentage,
      flatFee: fees.flatFee,
    };
  }

  @Get('wallet/transactions')
  async getWalletTransactions(@Param('tenantId') tenantId: string) {
    return this.walletService.listTransactions(tenantId);
  }

  @Post('wallet/topup')
  async manualTopup(@Param('tenantId') tenantId: string, @Body() body: { amount: number }) {
    return this.walletService.manualTopup(tenantId, body.amount);
  }

  @Post('wallet/auto-topup')
  async updateAutoTopup(
    @Param('tenantId') tenantId: string,
    @Body() body: { enabled: boolean; threshold: number; amount: number },
  ) {
    return this.walletService.updateAutoTopupConfig(
      tenantId,
      body.enabled,
      body.threshold,
      body.amount,
    );
  }

  @Post('assign-points')
  async assignPoints(
    @Param('tenantId') tenantId: string,
    @Body() body: {
      memberIds?: string[];
      points?: number;
      reason?: string;
      assignments?: { memberId: string; points: number }[];
    },
    @Req() req: any,
  ) {
    const actorId = req.user?.memberId ?? req.user?.id;
    return this.memberPointsService.assignPoints(
      tenantId,
      body.memberIds ?? [],
      body.points ?? 0,
      body.reason,
      actorId,
      body.assignments,
    );
  }

  @Get('custom')
  async listCustomRewards(@Param('tenantId') tenantId: string) {
    return this.customRewardsService.list(tenantId, true);
  }

  @Post('custom')
  async createCustomReward(
    @Param('tenantId') tenantId: string,
    @Body()
    body: {
      title: string;
      description?: string;
      pointsCost: number;
      imageUrl?: string;
      stockLimit?: number;
      deliveryInstructions?: string;
    },
  ) {
    return this.customRewardsService.create(tenantId, body);
  }

  @Patch('custom/:rewardId')
  async updateCustomReward(
    @Param('tenantId') tenantId: string,
    @Param('rewardId') rewardId: string,
    @Body()
    body: Partial<{
      title: string;
      description: string;
      pointsCost: number;
      imageUrl: string;
      isActive: boolean;
      stockLimit: number;
      deliveryInstructions: string;
    }>,
  ) {
    return this.customRewardsService.update(tenantId, rewardId, body);
  }

  @Delete('custom/:rewardId')
  async deleteCustomReward(
    @Param('tenantId') tenantId: string,
    @Param('rewardId') rewardId: string,
  ) {
    await this.customRewardsService.softDelete(tenantId, rewardId);
    return { success: true };
  }

  @Get('tasks')
  async listTasks(@Param('tenantId') tenantId: string, @Req() req: any) {
    const memberId = req.user?.memberId ?? req.user?.id;
    return this.rewardsService.listTasks(tenantId, memberId);
  }

  @Get('tasks/submissions/pending')
  async listPendingSubmissions(@Param('tenantId') tenantId: string, @Req() req: any) {
    const actorId = req.user?.memberId ?? req.user?.id;
    return this.rewardsService.listPendingSubmissions(tenantId, actorId);
  }

  @Post('tasks')
  async createTask(
    @Param('tenantId') tenantId: string,
    @Body()
    body: {
      title: string;
      description: string;
      points: number;
      icon: string;
      category?: string;
      imageUrl?: string;
      submissionType: 'instant' | 'text' | 'file';
      isRecurring?: boolean;
    },
  ) {
    return this.rewardsService.createTask(tenantId, body);
  }

  @Delete('tasks/:taskId')
  async deleteTask(@Param('tenantId') tenantId: string, @Param('taskId') taskId: string) {
    return this.rewardsService.deleteTask(tenantId, taskId);
  }

  @Post('tasks/:taskId/submit')
  async submitTask(
    @Param('tenantId') tenantId: string,
    @Param('taskId') taskId: string,
    @Req() req: any,
    @Body() body: { submissionText?: string; submissionFileName?: string },
  ) {
    const memberId = req.user?.memberId ?? req.user?.id;
    return this.rewardsService.submitTask(tenantId, taskId, memberId, body);
  }

  @Post('tasks/:taskId/submissions/:submissionId/approve')
  async approveSubmission(
    @Param('tenantId') tenantId: string,
    @Param('taskId') taskId: string,
    @Param('submissionId') submissionId: string,
    @Req() req: any,
  ) {
    const actorId = req.user?.memberId ?? req.user?.id;
    return this.rewardsService.approveSubmission(tenantId, taskId, submissionId, actorId);
  }

  @Post('tasks/:taskId/submissions/:submissionId/reject')
  async rejectSubmission(
    @Param('tenantId') tenantId: string,
    @Param('taskId') taskId: string,
    @Param('submissionId') submissionId: string,
    @Req() req: any,
  ) {
    const actorId = req.user?.memberId ?? req.user?.id;
    return this.rewardsService.rejectSubmission(tenantId, taskId, submissionId, actorId);
  }

  @Get('operators/:countryCode')
  async listTopupOperators(@Param('countryCode') countryCode: string) {
    return this.rewardsService.listTopupOperators(countryCode);
  }

  @Get('utilities/billers/:countryCode')
  async listUtilityBillers(@Param('countryCode') countryCode: string) {
    return this.rewardsService.listUtilityBillers(countryCode);
  }

  @Post('utilities/lookup')
  async lookupUtilityMeter(
    @Body() body: {
      countryCode: string;
      billerId: string;
      accountNumber: string;
      serviceType?: string;
    },
  ) {
    return this.rewardsService.lookupUtilityMeter(
      body.countryCode,
      body.billerId,
      body.accountNumber,
      body.serviceType,
    );
  }

  @Get('calculate-points')
  async calculatePointsCost(@Param('tenantId') tenantId: string, @Req() req: any) {
    const type = req.query.type as 'airtime' | 'utility';
    const billerId = Number(req.query.billerId);
    const amount = Number(req.query.amount);
    return this.rewardsService.calculatePointsCost(tenantId, type, billerId, amount);
  }
}
