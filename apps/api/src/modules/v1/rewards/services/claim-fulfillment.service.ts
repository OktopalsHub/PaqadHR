import { Injectable, Logger } from '@nestjs/common';
import { ProductAnalyticsService } from 'src/common/observability/product-analytics.service';
import { MonnifyBillApiService } from 'src/common/services/monnify-bill-api.service';
import { NombaBillApiService } from 'src/common/services/nomba-bill-api.service';
import { TremendousApiService } from 'src/common/services/tremendous-api.service';
import { DataSource } from 'typeorm';
import { ActivitiesService } from '../../activities/services/activities.service';
import { EmailTemplateService } from '../../notifications/services/email-template.service';
import { NotificationHelperService } from '../../notifications/services/notification-helper.service';
import { ZeptomailEmailService } from '../../notifications/services/zeptomail-email.service';
import { RedemptionStatus, RewardRedemption } from '../entities/reward-redemption.entity';
import { ClaimBillingService } from './claim-billing.service';
import {
  fulfillCustom,
  fulfillNombaTopup,
  fulfillNombaUtility,
  fulfillTremendous,
} from './claim-fulfillment-handlers';
import type { ClaimInput } from './claim-verification.service';
import { RewardsCatalogService } from './rewards-catalog.service';

@Injectable()
export class ClaimFulfillmentService {
  private readonly logger = new Logger(ClaimFulfillmentService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly nombaBillApi: NombaBillApiService,
    private readonly monnifyBillApi: MonnifyBillApiService,
    private readonly tremendousApi: TremendousApiService,
    private readonly activitiesService: ActivitiesService,
    private readonly emailTemplateService: EmailTemplateService,
    private readonly emailService: ZeptomailEmailService,
    private readonly notificationHelper: NotificationHelperService,
    private readonly productAnalytics: ProductAnalyticsService,
    private readonly billingService: ClaimBillingService,
    private readonly catalogService: RewardsCatalogService,
  ) {}

  async finalizeClaimFulfillment(params: {
    tenantId: string;
    memberId: string;
    input: ClaimInput;
    redemption: RewardRedemption;
    pointsCost: number;
    totalTenantDebit: number;
  }): Promise<RewardRedemption> {
    const { tenantId, memberId, input, pointsCost, totalTenantDebit } = params;
    const redemptionId = params.redemption.id;
    try {
      await this.runClaimFulfillment(params.redemption, input);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown fulfillment error';
      this.logger.error(`Reward fulfillment failed for ${redemptionId}: ${msg}`);
      const alreadyFailed = await this.dataSource
        .getRepository(RewardRedemption)
        .findOne({ where: { id: redemptionId, status: 'FAILED' as RedemptionStatus } });
      if (alreadyFailed) return alreadyFailed;
      await this.billingService.refundFailedClaim({
        tenantId,
        memberId,
        redemptionId,
        pointsCost,
        totalTenantDebit,
        input,
      });
      return this.dataSource
        .getRepository(RewardRedemption)
        .findOneOrFail({ where: { id: redemptionId, tenantId, memberId } });
    }
    void this.activitiesService
      .queueActivity({
        tenantId,
        actorMemberId: memberId,
        action: 'reward.redeemed',
        resourceType: 'reward',
        resourceId: redemptionId,
        description: `${input.rewardName ?? input.rewardId} redeemed`,
        metadata: {
          rewardName: input.rewardName ?? input.rewardId,
          pointsCost,
          rewardType: input.rewardType,
        },
      })
      .catch((err) =>
        this.logger.warn(`Failed to queue activity: ${err instanceof Error ? err.message : err}`),
      );
    this.productAnalytics.capture(memberId, 'reward_redeemed', { tenantId });
    void this.notificationHelper
      .sendRewardRedemptionNotification(memberId, tenantId, {
        rewardName: input.rewardName ?? input.rewardId,
        status: 'processing',
      })
      .catch((err) =>
        this.logger.warn(
          `Failed to send notification: ${err instanceof Error ? err.message : err}`,
        ),
      );
    return this.dataSource
      .getRepository(RewardRedemption)
      .findOneOrFail({ where: { id: redemptionId, tenantId, memberId } });
  }

  async runClaimFulfillment(redemption: RewardRedemption, input: ClaimInput): Promise<void> {
    if (input.rewardType === 'TREMENDOUS')
      return fulfillTremendous(
        this.dataSource,
        this.tremendousApi,
        this.catalogService,
        this.emailTemplateService,
        this.emailService,
        redemption,
        input,
      );
    if (input.rewardType === 'NOMBA_AIRTIME')
      return fulfillNombaTopup(
        this.dataSource,
        this.nombaBillApi,
        this.monnifyBillApi,
        redemption,
        input,
      );
    if (input.rewardType === 'NOMBA_UTILITY')
      return fulfillNombaUtility(
        this.dataSource,
        this.nombaBillApi,
        this.monnifyBillApi,
        redemption,
        input,
      );
    if (input.rewardType === 'CUSTOM') return fulfillCustom(this.dataSource, redemption);
  }
}
