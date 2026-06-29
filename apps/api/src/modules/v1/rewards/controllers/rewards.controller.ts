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
import { CustomRewardsService } from '../services/custom-rewards.service';
import { RewardsService, type ClaimInput } from '../services/rewards.service';
import { TenantWalletService } from '../services/tenant-wallet.service';

@ApiTags('Rewards')
@Controller('tenants/:tenantId/rewards')
export class RewardsController {
  constructor(
    private readonly rewardsService: RewardsService,
    private readonly walletService: TenantWalletService,
    private readonly customRewardsService: CustomRewardsService,
  ) {}

  
  @Post('webhooks/nomba')
  @Public()
  @HttpCode(HttpStatus.OK)
  async handleNombaWebhook(
    @Req() req: any,
    @Headers('x-nomba-signature') signature: string,
    @Headers('X-Nomba-Signature') signatureAlt: string,
  ) {
    const rawBody = req.rawBody?.toString('utf8') ?? '';
    return this.rewardsService.handleNombaFundingWebhook(
      rawBody,
      signature || signatureAlt || '',
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
  async claim(
    @Param('tenantId') tenantId: string,
    @Body() body: ClaimInput,
    @Req() req: any,
  ) {
    const memberId = req.user?.memberId ?? req.user?.id;
    return this.rewardsService.claim(tenantId, memberId, body);
  }

  
  @Get('claims/me')
  async getMyClaims(
    @Param('tenantId') tenantId: string,
    @Req() req: any,
  ) {
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
  async listTasks(
    @Param('tenantId') tenantId: string,
    @Req() req: any,
  ) {
    const memberId = req.user?.memberId ?? req.user?.id;
    return this.rewardsService.listTasks(tenantId, memberId);
  }

  
  @Get('tasks/submissions/pending')
  async listPendingSubmissions(@Param('tenantId') tenantId: string) {
    return this.rewardsService.listPendingSubmissions(tenantId);
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
    },
  ) {
    return this.rewardsService.createTask(tenantId, body);
  }

  
  @Delete('tasks/:taskId')
  async deleteTask(
    @Param('tenantId') tenantId: string,
    @Param('taskId') taskId: string,
  ) {
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
  ) {
    return this.rewardsService.approveSubmission(tenantId, taskId, submissionId);
  }

  
  @Post('tasks/:taskId/submissions/:submissionId/reject')
  async rejectSubmission(
    @Param('tenantId') tenantId: string,
    @Param('taskId') taskId: string,
    @Param('submissionId') submissionId: string,
  ) {
    return this.rewardsService.rejectSubmission(tenantId, taskId, submissionId);
  }
}
