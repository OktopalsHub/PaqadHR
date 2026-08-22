import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { runCronJob } from 'src/common/utils/cron-logging.util';
import { In, LessThan, Not, Repository } from 'typeorm';
import { RedemptionStatus, RewardRedemption } from '../entities/reward-redemption.entity';
import { RewardsService } from './rewards.service';

const PROCESSING_LEASE_MS = 5 * 60 * 1000;
const PENDING_STALE_MS = 30 * 60 * 1000;

@Injectable()
export class RewardsClaimCronService {
  private readonly logger = new Logger(RewardsClaimCronService.name);

  constructor(
    @InjectRepository(RewardRedemption)
    private readonly redemptionRepository: Repository<RewardRedemption>,
    private readonly rewardsService: RewardsService,
  ) {}

  @Cron('*/5 * * * *')
  async cleanupStaleClaims(): Promise<void> {
    await runCronJob(this.logger, 'rewards-claim-cleanup', async () => {
      let resetProcessing = 0;
      let refundedPending = 0;

      // 1. Reset PROCESSING claims stuck beyond the lease window
      const staleProcessingCutoff = new Date(Date.now() - PROCESSING_LEASE_MS);
      const staleProcessing = await this.redemptionRepository.find({
        where: {
          status: 'PROCESSING',
          processingStartedAt: LessThan(staleProcessingCutoff),
        },
      });

      const resetIds = new Set<string>();
      for (const claim of staleProcessing) {
        try {
          const result = await this.redemptionRepository
            .createQueryBuilder()
            .update(RewardRedemption)
            .set({ status: 'PENDING' as RedemptionStatus, processingStartedAt: null })
            .where('id = :id AND status = :status AND processingStartedAt < :cutoff', {
              id: claim.id,
              status: 'PROCESSING',
              cutoff: staleProcessingCutoff,
            })
            .execute();
          if (result.affected) {
            resetIds.add(claim.id);
            resetProcessing += 1;
          }
        } catch (err) {
          this.logger.warn(
            `Failed to reset PROCESSING claim ${claim.id}: ${err instanceof Error ? err.message : err}`,
          );
        }
      }

      // 2. Refund PENDING claims stuck beyond the stale window
      //    Exclude claims that were just reset from PROCESSING in this same run
      //    to prevent refunding a claim whose original fulfillment is still in-flight.
      const stalePendingCutoff = new Date(Date.now() - PENDING_STALE_MS);
      const stalePending = await this.redemptionRepository.find({
        where: {
          status: 'PENDING',
          createdAt: LessThan(stalePendingCutoff),
          ...(resetIds.size > 0 ? { id: Not(In(Array.from(resetIds))) } : {}),
        },
      });

      for (const claim of stalePending) {
        try {
          await this.rewardsService.refundStaleClaim(claim);
          refundedPending += 1;
        } catch (err) {
          this.logger.warn(
            `Failed to refund stale PENDING claim ${claim.id}: ${err instanceof Error ? err.message : err}`,
          );
        }
      }

      return {
        resetProcessing,
        refundedPending,
        total: staleProcessing.length + stalePending.length,
      };
    });
  }
}
