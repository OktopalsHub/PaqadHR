import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EmailTemplateService } from '../../notifications/services/email-template.service';
import { NotificationHelperService } from '../../notifications/services/notification-helper.service';
import { ZeptomailEmailService } from '../../notifications/services/zeptomail-email.service';
import { RewardRedemption } from '../../rewards/entities/reward-redemption.entity';
import { ClaimBillingService } from '../../rewards/services/claim-billing.service';
import type { ClaimInput } from '../../rewards/services/claim-verification.service';
import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';

/** Persisted on the redemption and shown to the member when Tremendous cannot deliver. */
const TREMENDOUS_FAILURE_MESSAGE = 'Tremendous could not deliver this reward. Points refunded.';

function isValidHttpsUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

interface TremendousWebhookPayload {
  event_type: string;
  payload?: {
    order?: {
      id?: string;
      external_id?: string;
      status?: string;
    };
    reward?: {
      id?: string;
      order_id?: string;
      external_id?: string;
      status?: string;
      delivery?: {
        status?: string;
        link?: string;
      };
      redemption?: {
        details?: {
          redemption_url?: string;
        };
      };
    };
  };
}

@Injectable()
export class TremendousWebhookService {
  private readonly logger = new Logger(TremendousWebhookService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly emailTemplateService: EmailTemplateService,
    private readonly emailService: ZeptomailEmailService,
    private readonly notificationHelper: NotificationHelperService,
    private readonly claimBillingService: ClaimBillingService,
  ) {}

  async dispatch(rawBody: string): Promise<{ received: boolean }> {
    let payload: TremendousWebhookPayload;
    try {
      payload = JSON.parse(rawBody) as TremendousWebhookPayload;
    } catch {
      this.logger.error('Invalid Tremendous webhook JSON');
      return { received: false };
    }

    this.logger.log(`Tremendous webhook received: ${payload.event_type}`);

    const eventType = payload.event_type ?? '';
    const reward = payload.payload?.reward;
    const order = payload.payload?.order;

    const redemptionId = reward?.external_id ?? order?.external_id ?? reward?.id ?? order?.id;

    if (!redemptionId) {
      this.logger.warn('Tremendous webhook missing redemption/order identifier');
      return { received: true };
    }

    if (eventType === 'REWARD_FULFILLMENT_SUCCESS' || eventType === 'reward.fulfilled') {
      await this.handleFulfillmentSuccess(String(redemptionId), reward);
    } else if (
      eventType === 'REWARD_FULFILLMENT_FAILED' ||
      eventType === 'reward.fulfillment_failed'
    ) {
      await this.handleFulfillmentFailure(String(redemptionId));
    }

    return { received: true };
  }

  private async handleFulfillmentSuccess(
    redemptionId: string,
    reward?: {
      id?: string;
      delivery?: { link?: string };
      redemption?: { details?: { redemption_url?: string } };
    },
  ): Promise<void> {
    const redemptionRepo = this.dataSource.getRepository(RewardRedemption);
    const redemption = await redemptionRepo.findOne({ where: { id: redemptionId } });

    if (!redemption) {
      this.logger.warn(`Tremendous webhook: redemption ${redemptionId} not found`);
      return;
    }

    if (redemption.status === 'FAILED') {
      return;
    }

    const deliveryLink = reward?.delivery?.link ?? reward?.redemption?.details?.redemption_url;
    const safeDeliveryLink =
      deliveryLink && isValidHttpsUrl(deliveryLink) ? deliveryLink : undefined;
    // The link can arrive after the order was already accepted at claim time.
    const pendingLink = safeDeliveryLink && !redemption.voucher?.code ? safeDeliveryLink : null;
    const alreadyFulfilled = redemption.status === 'SUCCESS';
    const providerRef = {
      ...redemption.providerRef,
      txRef: reward?.id ?? redemption.providerRef?.txRef,
    };

    if (alreadyFulfilled) {
      if (pendingLink) {
        await redemptionRepo.update(redemption.id, {
          providerRef,
          voucher: {
            ...redemption.voucher,
            code: pendingLink,
            instructions: 'Open this link to choose and redeem your gift card.',
          },
        });
      }
    } else {
      await redemptionRepo.update(redemption.id, {
        status: 'SUCCESS',
        providerRef,
        processingStartedAt: null,
        ...(pendingLink
          ? {
              voucher: {
                ...redemption.voucher,
                code: pendingLink,
                instructions: 'Open this link to choose and redeem your gift card.',
              },
            }
          : {}),
      });
    }

    if (pendingLink) {
      void this.sendRewardClaimEmail(redemption, pendingLink).catch((err) => {
        this.logger.warn(
          `Failed to send reward claim email for ${redemption.id}: ${err instanceof Error ? err.message : err}`,
        );
      });
    }

    // The claim-time notification already covered orders marked successful on submission.
    if (alreadyFulfilled) return;

    void this.notificationHelper
      .sendRewardRedemptionNotification(redemption.memberId, redemption.tenantId, {
        rewardName: redemption.rewardName ?? 'Gift Card',
        status: 'fulfilled',
      })
      .catch((err) => {
        this.logger.warn(
          `Failed to notify fulfilled reward ${redemption.id}: ${err instanceof Error ? err.message : err}`,
        );
      });
  }

  private async sendRewardClaimEmail(
    redemption: RewardRedemption,
    deliveryLink: string,
  ): Promise<void> {
    const member = await this.dataSource
      .getRepository(TenantMember)
      .createQueryBuilder('m')
      .leftJoin('m.user', 'u')
      .select(['m.id', 'm.firstName', 'm.lastName', 'm.preferredName', 'u.id', 'u.email'])
      .where('m.id = :id AND m.tenantId = :tenantId', {
        id: redemption.memberId,
        tenantId: redemption.tenantId,
      })
      .getOne();

    const recipientEmail = redemption.recipient?.email ?? member?.user?.email;
    if (!recipientEmail) {
      this.logger.warn(`No recipient email for redemption ${redemption.id}, skipping email`);
      return;
    }

    const recipientName =
      member?.preferredName?.trim() ||
      `${member?.firstName ?? ''} ${member?.lastName ?? ''}`.trim() ||
      'Member';

    const rendered = this.emailTemplateService.render('reward-claim', {
      employeeName: recipientName,
      employeeEmail: recipientEmail,
      rewardName: redemption.rewardName ?? 'Gift Card',
      rewardAmount: redemption.currencyValue,
      currencyCode: redemption.currencyCode,
      redemptionUrl: deliveryLink,
      referenceId: redemption.id,
      providerName: 'Tremendous',
      providerLogoUrl: 'https://www.tremendous.com/img/tremendous-logo.png',
    });

    await this.emailService.sendEmail({
      to: recipientEmail,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
  }

  private async handleFulfillmentFailure(redemptionId: string): Promise<void> {
    const redemptionRepo = this.dataSource.getRepository(RewardRedemption);
    const redemption = await redemptionRepo.findOne({ where: { id: redemptionId } });

    if (!redemption) {
      this.logger.warn(`Tremendous webhook: redemption ${redemptionId} not found`);
      return;
    }

    if (redemption.status === 'FAILED') {
      return;
    }

    const input: ClaimInput = {
      rewardType: redemption.rewardType,
      rewardId: redemption.rewardId ?? redemption.id,
      rewardName: redemption.rewardName ?? undefined,
      pointsCost: redemption.pointsSpent,
      currencyValue: Number(redemption.currencyValue),
      currencyCode: redemption.currencyCode,
    };

    const refunded = await this.claimBillingService.refundFailedClaim({
      tenantId: redemption.tenantId,
      memberId: redemption.memberId,
      redemptionId: redemption.id,
      pointsCost: redemption.pointsSpent,
      // Fallback only; the real debit is resolved from the stored SPENT transaction.
      totalTenantDebit: 0,
      input,
      failureReason: TREMENDOUS_FAILURE_MESSAGE,
    });

    if (!refunded) return;

    void this.notificationHelper
      .sendRewardRedemptionNotification(redemption.memberId, redemption.tenantId, {
        rewardName: redemption.rewardName ?? 'Gift Card',
        status: 'failed',
        failureReason: TREMENDOUS_FAILURE_MESSAGE,
      })
      .catch((err) => {
        this.logger.warn(
          `Failed to notify failed reward ${redemption.id}: ${err instanceof Error ? err.message : err}`,
        );
      });
  }
}
