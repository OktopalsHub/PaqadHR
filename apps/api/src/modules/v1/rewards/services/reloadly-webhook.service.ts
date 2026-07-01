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

  async processReloadlyWebhookEvent(payload: any): Promise<void> {
    const status = (payload.status || payload.transaction?.status || '').toUpperCase();
    const customIdentifier = payload.transaction?.customIdentifier || payload.customIdentifier;
    const providerTxRef = payload.transaction?.transactionId || payload.transactionId;

    if (!customIdentifier) {
      this.logger.log('Reloadly webhook payload is missing customIdentifier — ignoring');
      return;
    }

    const redemptionRepo = this.dataSource.getRepository(RewardRedemption);
    const redemption = await redemptionRepo.findOne({
      where: { id: customIdentifier },
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
          providerTxRef: providerTxRef ? String(providerTxRef) : redemption.providerTxRef,
        });
        this.logger.log(`Reloadly redemption ${redemption.id} status updated to SUCCESS`);
      }
      return;
    }

    if (status === 'FAILED' || status === 'REFUNDED' || status === 'FAILED_REFUNDED') {
      if (redemption.status === 'FAILED') {
        this.logger.log(`Reloadly redemption ${redemption.id} is already in FAILED state`);
        return;
      }

      await this.dataSource.transaction(async (manager) => {
        // Fetch fresh copy inside transaction
        const currentRedemption = await manager.getRepository(RewardRedemption).findOneOrFail({
          where: { id: redemption.id },
        });

        if (currentRedemption.status === 'FAILED') {
          return;
        }

        const pointsCost = currentRedemption.pointsSpent;
        const tenantId = currentRedemption.tenantId;
        const memberId = currentRedemption.memberId;

        // 1. Re-credit member points
        const pointsRepo = manager.getRepository(ShoutoutMemberPoints);
        await pointsRepo
          .createQueryBuilder()
          .update(ShoutoutMemberPoints)
          .set({ currentBalance: () => `current_balance + ${pointsCost}` })
          .where('tenant_id = :tenantId AND member_id = :memberId', { tenantId, memberId })
          .execute();

        const txRepo = manager.getRepository(ShoutoutPointTransaction);
        const updatedPoints = await pointsRepo.findOneOrFail({ where: { tenantId, memberId } });
        const refundTx = txRepo.create({
          tenantId,
          memberId,
          type: ShoutoutPointTransactionType.REDEMPTION,
          points: pointsCost,
          runningBalance: updatedPoints.currentBalance,
          description: `Refund: ${currentRedemption.rewardName ?? currentRedemption.rewardId} — Reloadly transaction ${status.toLowerCase()}`,
          createdBy: memberId,
        });
        await txRepo.save(refundTx);

        // 2. Re-credit tenant wallet (if not CUSTOM reward)
        if (currentRedemption.rewardType !== 'CUSTOM') {
          const wallet = await this.walletService.ensureWallet(tenantId, manager);
          const tx = await manager.getRepository(TenantWalletTransaction).findOne({
            where: {
              tenantWalletId: wallet.id,
              reference: currentRedemption.id,
              type: 'SPENT' as any,
            },
          });
          const refundAmount = tx ? Math.abs(Number(tx.amount)) : 0;

          if (refundAmount > 0) {
            await this.walletService.credit(
              tenantId,
              refundAmount,
              'REFUND',
              currentRedemption.id,
              `Refund: ${currentRedemption.rewardName ?? currentRedemption.rewardId}`,
              manager,
            );
          }
        }

        // 3. Mark redemption as failed
        await manager.getRepository(RewardRedemption).update(currentRedemption.id, {
          status: 'FAILED',
          errorMessage: `Reloadly transaction ${status.toLowerCase()}`,
        });
        this.logger.log(`Reloadly redemption ${currentRedemption.id} refunded and marked FAILED`);
      });
    }
  }
}
