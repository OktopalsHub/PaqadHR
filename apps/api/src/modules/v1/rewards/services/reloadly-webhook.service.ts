import { Injectable, Logger } from '@nestjs/common';
import { ShoutoutPointTransactionType } from 'src/common/enums/shoutout-point-transaction-type.enum';
import { DataSource } from 'typeorm';
import { ShoutoutMemberPoints } from '../../shoutouts/entities/shoutout-member-points.entity';
import { ShoutoutPointTransaction } from '../../shoutouts/entities/shoutout-point-transaction.entity';
import { RewardRedemption } from '../entities/reward-redemption.entity';
import { TenantWalletTransaction } from '../entities/tenant-wallet-transaction.entity';
import { TenantWalletService } from './tenant-wallet.service';

@Injectable()
export class ReloadlyWebhookService {
  private readonly logger = new Logger(ReloadlyWebhookService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly walletService: TenantWalletService,
  ) {}

  async processReloadlyWebhookEvent(payload: Record<string, unknown>): Promise<void> {
    const status = String(
      payload.status || (payload.transaction as Record<string, unknown> | undefined)?.status || '',
    ).toUpperCase();
    const transaction = payload.transaction as Record<string, unknown> | undefined;
    const customIdentifier = transaction?.customIdentifier || payload.customIdentifier;
    const providerTxRef = transaction?.transactionId || payload.transactionId;

    if (!customIdentifier) {
      return;
    }

    const redemptionId = String(customIdentifier);

    const redemptionRepo = this.dataSource.getRepository(RewardRedemption);
    const redemption = await redemptionRepo.findOne({
      where: { id: redemptionId },
    });

    if (!redemption) {
      this.logger.warn(
        `Reloadly webhook customIdentifier ${customIdentifier} not found in database`,
      );
      return;
    }

    if (status === 'SUCCESSFUL' || status === 'SUCCESS') {
      if (redemption.status !== 'SUCCESS') {
        await redemptionRepo.update(redemption.id, {
          status: 'SUCCESS',
          providerRef: {
            ...redemption.providerRef,
            txRef: providerTxRef ? String(providerTxRef) : redemption.providerRef?.txRef,
          },
        });
      }
      return;
    }

    if (status === 'FAILED' || status === 'REFUNDED' || status === 'FAILED_REFUNDED') {
      if (redemption.status === 'FAILED') {
        return;
      }

      await this.dataSource.transaction(async (manager) => {
        const redemptionRepo = manager.getRepository(RewardRedemption);

        // Conditional status flip is the idempotency guard: the first executor
        // (this webhook, a retried delivery, or the claim failure handler) that
        // flips this redemption to FAILED performs the refunds. Everything else
        // skips, so overlapping events cannot double-credit points or wallet.
        // A failure mid-refund rolls the whole transaction back, so the
        // redemption never ends up FAILED with a partial refund.
        const flip = await redemptionRepo
          .createQueryBuilder()
          .update(RewardRedemption)
          .set({
            status: 'FAILED',
            providerRef: {
              ...redemption.providerRef,
              error: `Reloadly transaction ${status.toLowerCase()}`,
            },
          })
          .where(
            'id = :id AND tenant_id = :tenantId AND member_id = :memberId AND status <> :failed',
            {
              id: redemption.id,
              tenantId: redemption.tenantId,
              memberId: redemption.memberId,
              failed: 'FAILED' as const,
            },
          )
          .execute();

        if (!flip.affected) {
          return;
        }

        const pointsCost = redemption.pointsSpent;
        const tenantId = redemption.tenantId;
        const memberId = redemption.memberId;

        // Re-credit member points
        const pointsRepo = manager.getRepository(ShoutoutMemberPoints);
        await pointsRepo
          .createQueryBuilder()
          .update(ShoutoutMemberPoints)
          .set({ currentBalance: () => 'current_balance + :pointsCost' })
          .where('tenant_id = :tenantId AND member_id = :memberId', {
            tenantId,
            memberId,
            pointsCost,
          })
          .execute();

        const txRepo = manager.getRepository(ShoutoutPointTransaction);
        const updatedPoints = await pointsRepo.findOneOrFail({ where: { tenantId, memberId } });
        const refundTx = txRepo.create({
          tenantId,
          memberId,
          type: ShoutoutPointTransactionType.REDEMPTION,
          points: pointsCost,
          runningBalance: updatedPoints.currentBalance,
          description: `Refund: ${redemption.rewardName ?? redemption.rewardId}`,
          createdBy: memberId,
        });
        await txRepo.save(refundTx);

        // Re-credit tenant wallet (if not CUSTOM reward)
        if (redemption.rewardType !== 'CUSTOM') {
          const wallet = await this.walletService.ensureWallet(tenantId, manager);
          const tx = await manager.getRepository(TenantWalletTransaction).findOne({
            where: {
              tenantWalletId: wallet.id,
              reference: redemption.id,
              type: 'SPENT' as const,
            },
          });
          const refundAmount = tx ? Math.abs(Number(tx.amount)) : 0;

          if (refundAmount > 0) {
            await this.walletService.credit(
              tenantId,
              refundAmount,
              'REFUND',
              `refund:${redemption.id}`,
              `Refund: ${redemption.rewardName ?? redemption.rewardId}`,
              manager,
              { actorMemberId: memberId },
            );
          }
        }
      });
    }
  }
}
