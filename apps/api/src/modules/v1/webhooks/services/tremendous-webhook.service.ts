import { Injectable, Logger } from '@nestjs/common';
import { ShoutoutPointTransactionType } from 'src/common/enums/shoutout-point-transaction-type.enum';
import { DataSource } from 'typeorm';
import { RewardRedemption } from '../../rewards/entities/reward-redemption.entity';
import { TenantWalletService } from '../../rewards/services/tenant-wallet.service';
import { ShoutoutMemberPoints } from '../../shoutouts/entities/shoutout-member-points.entity';
import { ShoutoutPointTransaction } from '../../shoutouts/entities/shoutout-point-transaction.entity';

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
  ) {}

  async dispatch(rawBody: string, signature: string): Promise<{ received: boolean }> {
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
    reward?: TremendousWebhookPayload['payload']['reward'],
  ): Promise<void> {
    const redemptionRepo = this.dataSource.getRepository(RewardRedemption);
    const redemption = await redemptionRepo.findOne({ where: { id: redemptionId } });

    if (!redemption) {
      this.logger.warn(`Tremendous webhook: redemption ${redemptionId} not found`);
      return;
    }

    if (redemption.status === 'SUCCESS') {
      return;
    }

    const deliveryLink = reward?.delivery?.link ?? reward?.redemption?.details?.redemption_url;
    await redemptionRepo.update(redemption.id, {
      status: 'SUCCESS',
      providerRef: {
        ...redemption.providerRef,
        tremendousRewardId: reward?.id,
        deliveryLink,
      },
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

    await this.dataSource.transaction(async (manager) => {
      const currentRedemption = await manager.getRepository(RewardRedemption).findOneOrFail({
        where: { id: redemption.id },
      });

      if (currentRedemption.status === 'FAILED') {
        return;
      }

      const pointsCost = currentRedemption.pointsSpent;
      const tenantId = currentRedemption.tenantId;
      const memberId = currentRedemption.memberId;

      const pointsRepo = manager.getRepository(ShoutoutMemberPoints);
      await pointsRepo
        .createQueryBuilder()
        .update(ShoutoutMemberPoints)
        .set({ currentBalance: () => `"currentBalance" + ${pointsCost}` })
        .where('"tenantId" = :tenantId AND "memberId" = :memberId', { tenantId, memberId })
        .execute();

      const txRepo = manager.getRepository(ShoutoutPointTransaction);
      await txRepo.save(
        txRepo.create({
          tenantId,
          memberId,
          type: ShoutoutPointTransactionType.REFUND,
          points: pointsCost,
          reason: `Tremendous fulfillment failed for redemption ${redemption.id}`,
        }),
      );

      await manager.getRepository(RewardRedemption).update(currentRedemption.id, {
        status: 'FAILED',
        failedReason: 'Tremendous fulfillment failed',
      });

      if (currentRedemption.pointsSpent > 0) {
        await this.walletService.credit(
          tenantId,
          currentRedemption.pointsSpent,
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
