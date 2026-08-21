import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ShoutoutMemberPoints } from '../../shoutouts/entities/shoutout-member-points.entity';
import { ShoutoutPointTransaction } from '../../shoutout-point-transaction.entity';
import { ShoutoutPointTransactionType } from 'src/common/enums/shoutout-point-transaction-type.enum';
import { Shoutout } from '../../shoutouts/entities/shoutout.entity';
import { RewardsFeeService } from './rewards-fee.service';
import { computeRedemptionDebit } from '../utils/rewards-redemption.util';

@Injectable()
export class RewardsPointsService {
  private readonly logger = new Logger(RewardsPointsService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly feeService: RewardsFeeService,
  ) {}

  async calculateLocalRewardCost(
    tenantId: string,
    amount: number,
    pointsExchangeRate: number,
  ): Promise<{
    pointsCost: number;
    currencyValue: number;
    currencyCode: string;
    totalTenantDebit: number;
    processingFee: number;
  }> {
    const { feePercentage } = await this.feeService.getSubscriptionFees(tenantId, 'NGN');
    const totalTenantDebit = computeRedemptionDebit(amount, feePercentage);
    const pointsCost = Math.ceil(totalTenantDebit * pointsExchangeRate);

    return {
      pointsCost,
      currencyValue: amount,
      currencyCode: 'NGN',
      totalTenantDebit,
      processingFee: Number((totalTenantDebit - amount).toFixed(2)),
    };
  }

  async awardPointsForTask(
    tenantId: string,
    memberId: string,
    points: number,
    taskTitle: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const pointsRepo = manager.getRepository(ShoutoutMemberPoints);
      const txRepo = manager.getRepository(ShoutoutPointTransaction);
      const shoutoutRepo = manager.getRepository(Shoutout);

      let row = await pointsRepo.findOne({ where: { tenantId, memberId } });
      if (!row) {
        row = pointsRepo.create({
          tenantId,
          memberId,
          currentBalance: 0,
          totalEarned: 0,
          lastResetDate: new Date(),
        });
      }

      row.currentBalance += points;
      row.totalEarned += points;
      await manager.save(row);

      await txRepo.save(
        txRepo.create({
          tenantId,
          memberId,
          type: ShoutoutPointTransactionType.ADMIN_ASSIGN,
          points,
          runningBalance: row.currentBalance,
          description: `Completed task: ${taskTitle}`,
          createdBy: memberId,
        }),
      );

      await shoutoutRepo.save(
        shoutoutRepo.create({
          tenantId,
          totalPoints: points,
          createdBy: memberId,
          message: `completed task: ${taskTitle}`,
        }),
      );
    });
  }

  async refundPoints(
    tenantId: string,
    memberId: string,
    pointsCost: number,
    redemptionId: string,
    rewardName: string,
    errorMessage: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const pointsRepo = manager.getRepository(ShoutoutMemberPoints);
      const txRepo = manager.getRepository(ShoutoutPointTransaction);

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
      if (updatedPoints) {
        const refundTx = txRepo.create({
          tenantId,
          memberId,
          type: ShoutoutPointTransactionType.REDEMPTION,
          points: pointsCost,
          runningBalance: updatedPoints.currentBalance,
          description: `Refund: ${rewardName} — ${errorMessage}`,
          createdBy: memberId,
        });
        await txRepo.save(refundTx);
      }
    });
  }

  async deductPoints(
    tenantId: string,
    memberId: string,
    pointsCost: number,
    rewardName: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const pointsRepo = manager.getRepository(ShoutoutMemberPoints);
      const txRepo = manager.getRepository(ShoutoutPointTransaction);

      const memberPoints = await pointsRepo.findOne({ where: { tenantId, memberId } });
      if (!memberPoints || memberPoints.currentBalance < pointsCost) {
        throw new BadRequestException(
          `Insufficient points. You need ${pointsCost} points but have ${memberPoints?.currentBalance ?? 0}.`,
        );
      }

      const updateResult = await pointsRepo
        .createQueryBuilder()
        .update(ShoutoutMemberPoints)
        .set({ currentBalance: () => 'current_balance - :pointsCost' })
        .where(
          'tenant_id = :tenantId AND member_id = :memberId AND current_balance >= :pointsCost',
          {
            tenantId,
            memberId,
            pointsCost,
          },
        )
        .execute();

      if (!updateResult.affected) {
        throw new BadRequestException('Insufficient points or transaction conflict.');
      }

      const updatedPoints = await pointsRepo.findOneOrFail({ where: { tenantId, memberId } });
      const pointsTx = txRepo.create({
        tenantId,
        memberId,
        type: ShoutoutPointTransactionType.REDEMPTION,
        points: -pointsCost,
        runningBalance: updatedPoints.currentBalance,
        description: `Redeemed for: ${rewardName}`,
        createdBy: memberId,
      });
      await txRepo.save(pointsTx);
    });
  }
}
