import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RewardRedemption } from '../../rewards/entities/reward-redemption.entity';
import { TenantWalletService } from '../../rewards/services/tenant-wallet.service';
import { EmailTemplateService } from '../../notifications/services/email-template.service';
import { ZeptomailEmailService } from '../../notifications/services/zeptomail-email.service';
import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';

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
    private readonly walletService: TenantWalletService,
    private readonly emailTemplateService: EmailTemplateService,
    private readonly emailService: ZeptomailEmailService,
  ) {}

  async dispatch(rawBody: string, _signature: string): Promise<{ received: boolean }> {
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

    if (redemption.status === 'SUCCESS' || redemption.status === 'FAILED') {
      return;
    }

    const deliveryLink = reward?.delivery?.link ?? reward?.redemption?.details?.redemption_url;
    const safeDeliveryLink =
      deliveryLink && isValidHttpsUrl(deliveryLink) ? deliveryLink : undefined;

    await redemptionRepo.update(redemption.id, {
      status: 'SUCCESS',
      providerRef: {
        ...redemption.providerRef,
        txRef: reward?.id ?? redemption.providerRef?.txRef,
      },
      ...(safeDeliveryLink
        ? {
            voucher: {
              ...redemption.voucher,
              code: safeDeliveryLink,
              instructions: 'Open this link to choose and redeem your gift card.',
            },
          }
        : {}),
    });

    if (safeDeliveryLink && !redemption.voucher?.code) {
      void this.sendRewardClaimEmail(redemption, safeDeliveryLink).catch((err) => {
        this.logger.warn(
          `Failed to send reward claim email for ${redemption.id}: ${err instanceof Error ? err.message : err}`,
        );
      });
    }
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

    if (redemption.status === 'SUCCESS' || redemption.status === 'FAILED') {
      return;
    }

    await this.dataSource.transaction(async (manager) => {
      const currentRedemption = await manager.getRepository(RewardRedemption).findOneOrFail({
        where: { id: redemption.id },
      });

      if (currentRedemption.status === 'SUCCESS' || currentRedemption.status === 'FAILED') {
        return;
      }

      const pointsCost = currentRedemption.pointsSpent;
      const tenantId = currentRedemption.tenantId;
      const memberId = currentRedemption.memberId;

      await manager.getRepository(RewardRedemption).update(currentRedemption.id, {
        status: 'FAILED',
        providerRef: {
          ...currentRedemption.providerRef,
          error: 'Tremendous fulfillment failed',
        },
      });

      if (pointsCost > 0) {
        await this.walletService.credit(
          tenantId,
          pointsCost,
          'REFUND',
          `refund:${currentRedemption.id}`,
          `Refund: ${currentRedemption.rewardName ?? currentRedemption.rewardId}`,
          manager,
          { actorMemberId: memberId },
        );
      }
    });
  }
}
