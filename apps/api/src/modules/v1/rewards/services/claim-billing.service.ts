import { BadRequestException, Injectable } from '@nestjs/common';
import { ShoutoutPointTransactionType } from 'src/common/enums/shoutout-point-transaction-type.enum';
import { DataSource } from 'typeorm';
import { ShoutoutMemberPoints } from '../../shoutouts/entities/shoutout-member-points.entity';
import { ShoutoutPointTransaction } from '../../shoutouts/entities/shoutout-point-transaction.entity';
import { CustomReward } from '../entities/custom-reward.entity';
import { RedemptionStatus, RewardRedemption } from '../entities/reward-redemption.entity';
import { TenantWallet } from '../entities/tenant-wallet.entity';
import { TenantWalletTransaction } from '../entities/tenant-wallet-transaction.entity';
import type { ClaimInput } from './claim-verification.service';
import { TenantWalletService } from './tenant-wallet.service';

@Injectable()
export class ClaimBillingService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly walletService: TenantWalletService,
  ) {}

  async debitPointsAndWallet(params: {
    tenantId: string;
    memberId: string;
    input: ClaimInput;
    redemptionId: string;
    pointsCost: number;
    totalTenantDebit: number;
    currencyCode: string;
    costs: { totalTenantDebit: number; faceValueInRewardsCurrency: number };
  }): Promise<void> {
    const { tenantId, memberId, input, redemptionId, pointsCost, costs, currencyCode } = params;

    await this.dataSource.transaction(async (manager) => {
      if (
        await manager
          .getRepository(RewardRedemption)
          .findOne({ where: { id: redemptionId, tenantId, memberId } })
      )
        throw new BadRequestException('Reward claim is already being processed. Please wait.');
      if (input.rewardType === 'CUSTOM') {
        const cr = await manager
          .getRepository(CustomReward)
          .findOneOrFail({ where: { id: input.rewardId, tenantId } });
        if (!cr.isActive) throw new BadRequestException('This custom reward is currently inactive');
        if (pointsCost !== cr.pointsCost)
          throw new BadRequestException(`Invalid points cost for custom reward: ${cr.pointsCost}`);
        if (cr.stockLimit !== null) {
          if (cr.stockLimit <= 0) throw new BadRequestException('Reward is out of stock');
          await manager
            .getRepository(CustomReward)
            .update(cr.id, { stockLimit: cr.stockLimit - 1 });
        }
      }
      const pointsRepo = manager.getRepository(ShoutoutMemberPoints);
      const memberPoints = await pointsRepo.findOne({ where: { tenantId, memberId } });
      if (!memberPoints || memberPoints.currentBalance < pointsCost)
        throw new BadRequestException(
          `Insufficient points. You need ${pointsCost} points but have ${memberPoints?.currentBalance ?? 0}.`,
        );
      const updateResult = await pointsRepo
        .createQueryBuilder()
        .update(ShoutoutMemberPoints)
        .set({ currentBalance: () => 'current_balance - :pointsCost' })
        .where(
          'tenant_id = :tenantId AND member_id = :memberId AND current_balance >= :pointsCost',
          { tenantId, memberId, pointsCost },
        )
        .execute();
      if (!updateResult.affected)
        throw new BadRequestException('Insufficient points or transaction conflict.');
      const txRepo = manager.getRepository(ShoutoutPointTransaction);
      const updatedPoints = await pointsRepo.findOneOrFail({ where: { tenantId, memberId } });
      await txRepo.save(
        txRepo.create({
          tenantId,
          memberId,
          type: ShoutoutPointTransactionType.REDEMPTION,
          points: -pointsCost,
          runningBalance: updatedPoints.currentBalance,
          description: `Redeemed for: ${input.rewardName ?? input.rewardId}`,
          createdBy: memberId,
        }),
      );
      if (input.rewardType !== 'CUSTOM')
        await this.walletService.debit(
          tenantId,
          costs.totalTenantDebit,
          redemptionId,
          `Reward claim: ${input.rewardName ?? input.rewardId} (Face Value: ${currencyCode} ${input.currencyValue}, Platform Fees: ${Number((costs.totalTenantDebit - costs.faceValueInRewardsCurrency).toFixed(2))})`,
          memberId,
          manager,
        );
    });
  }

  async refundFailedClaim(params: {
    tenantId: string;
    memberId: string;
    redemptionId: string;
    pointsCost: number;
    totalTenantDebit: number;
    input: ClaimInput;
  }): Promise<void> {
    const { tenantId, memberId, redemptionId, pointsCost, totalTenantDebit, input } = params;

    let originalDebitAmount = totalTenantDebit;
    const originalDebit = await this.dataSource
      .getRepository(TenantWalletTransaction)
      .findOne({ where: { reference: redemptionId, type: 'SPENT' } });
    if (originalDebit) originalDebitAmount = Math.abs(Number(originalDebit.amount));

    await this.dataSource.transaction(async (manager) => {
      const flip = await manager
        .getRepository(RewardRedemption)
        .createQueryBuilder()
        .update(RewardRedemption)
        .set({
          status: 'FAILED' as RedemptionStatus,
          providerRef: { error: 'Fulfillment failed' },
          processingStartedAt: null,
        })
        .where(
          'id = :redemptionId AND tenant_id = :tenantId AND member_id = :memberId AND status <> :failed',
          { redemptionId, tenantId, memberId, failed: 'FAILED' as RedemptionStatus },
        )
        .execute();
      if (!flip.affected) return;
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
      const updatedPoints = await pointsRepo.findOne({ where: { tenantId, memberId } });
      if (updatedPoints)
        await txRepo.save(
          txRepo.create({
            tenantId,
            memberId,
            type: ShoutoutPointTransactionType.REDEMPTION,
            points: pointsCost,
            runningBalance: updatedPoints.currentBalance,
            description: `Refund: ${input.rewardName ?? input.rewardId}`,
            createdBy: memberId,
          }),
        );

      if (input.rewardType !== 'CUSTOM') {
        const wallet = await manager
          .getRepository(TenantWallet)
          .createQueryBuilder('w')
          .setLock('pessimistic_write')
          .where('w.tenant_id = :tenantId', { tenantId })
          .getOne();
        if (wallet) {
          const existingRefund = await manager
            .getRepository(TenantWalletTransaction)
            .findOne({ where: { reference: `refund:${redemptionId}`, type: 'REFUND' } });
          if (!existingRefund) {
            await manager
              .getRepository(TenantWallet)
              .createQueryBuilder()
              .update(TenantWallet)
              .set({ balanceAmount: () => 'balance_amount + :amount' })
              .where('tenant_id = :tenantId', { tenantId, amount: originalDebitAmount })
              .execute();
            await manager.getRepository(TenantWalletTransaction).save(
              manager.getRepository(TenantWalletTransaction).create({
                tenantWalletId: wallet.id,
                type: 'REFUND',
                amount: originalDebitAmount,
                reference: `refund:${redemptionId}`,
                description: `Refund: ${input.rewardName ?? input.rewardId}`,
                status: 'COMPLETED',
                rawAmount: originalDebitAmount,
                metadata: { actorMemberId: memberId },
              }),
            );
          }
        }
      }
      if (input.rewardType === 'CUSTOM') {
        const cr = await manager
          .getRepository(CustomReward)
          .findOne({ where: { id: input.rewardId, tenantId } });
        if (cr && cr.stockLimit !== null)
          await manager
            .getRepository(CustomReward)
            .update(cr.id, { stockLimit: cr.stockLimit + 1 });
      }
    });
  }

  async refundStaleClaim(redemption: RewardRedemption): Promise<boolean> {
    const {
      tenantId,
      memberId,
      id: redemptionId,
      pointsSpent: pointsCost,
      rewardType,
    } = redemption;
    const originalDebit = await this.dataSource
      .getRepository(TenantWalletTransaction)
      .findOne({ where: { reference: redemptionId, type: 'SPENT' } });
    const originalDebitAmount = originalDebit ? Math.abs(Number(originalDebit.amount)) : 0;

    await this.dataSource.transaction(async (manager) => {
      const flip = await manager
        .getRepository(RewardRedemption)
        .createQueryBuilder()
        .update(RewardRedemption)
        .set({
          status: 'FAILED' as RedemptionStatus,
          providerRef: { ...redemption.providerRef, error: 'Stale processing lease expired' },
          processingStartedAt: null,
        })
        .where(
          'id = :redemptionId AND tenant_id = :tenantId AND member_id = :memberId AND status = :status',
          { redemptionId, tenantId, memberId, status: 'PROCESSING' },
        )
        .execute();
      if (!flip.affected) return;
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
      const updatedPoints = await pointsRepo.findOne({ where: { tenantId, memberId } });
      if (updatedPoints)
        await manager.getRepository(ShoutoutPointTransaction).save(
          manager.getRepository(ShoutoutPointTransaction).create({
            tenantId,
            memberId,
            type: ShoutoutPointTransactionType.REDEMPTION,
            points: pointsCost,
            runningBalance: updatedPoints.currentBalance,
            description: `Refund: stale claim ${redemptionId}`,
            createdBy: memberId,
          }),
        );
      if (rewardType !== 'CUSTOM') {
        const wallet = await manager
          .getRepository(TenantWallet)
          .createQueryBuilder('w')
          .setLock('pessimistic_write')
          .where('w.tenant_id = :tenantId', { tenantId })
          .getOne();
        if (
          wallet &&
          !(await manager
            .getRepository(TenantWalletTransaction)
            .findOne({ where: { reference: `refund:${redemptionId}`, type: 'REFUND' } }))
        ) {
          await manager
            .getRepository(TenantWallet)
            .createQueryBuilder()
            .update(TenantWallet)
            .set({ balanceAmount: () => 'balance_amount + :amount' })
            .where('tenant_id = :tenantId', { tenantId, amount: originalDebitAmount })
            .execute();
          await manager.getRepository(TenantWalletTransaction).save(
            manager.getRepository(TenantWalletTransaction).create({
              tenantWalletId: wallet.id,
              type: 'REFUND',
              amount: originalDebitAmount,
              reference: `refund:${redemptionId}`,
              description: 'Refund: stale claim',
              status: 'COMPLETED',
              rawAmount: originalDebitAmount,
              metadata: { actorMemberId: memberId },
            }),
          );
        }
      }
      if (rewardType === 'CUSTOM') {
        const cr = await manager
          .getRepository(CustomReward)
          .findOne({ where: { id: redemption.rewardId ?? undefined, tenantId } });
        if (cr?.stockLimit != null)
          await manager
            .getRepository(CustomReward)
            .update(cr.id, { stockLimit: cr.stockLimit + 1 });
      }
    });
    return true;
  }
}
