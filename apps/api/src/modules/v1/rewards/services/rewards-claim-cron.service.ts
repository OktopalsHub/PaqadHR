import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { runCronJob } from 'src/common/utils/cron-logging.util';
import { LessThan, Repository } from 'typeorm';
import { RewardRedemption } from '../entities/reward-redemption.entity';
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

      for (const claim of staleProcessing) {
        try {
          await this.redemptionRepository.update(claim.id, {
            status: 'PENDING',
            processingStartedAt: null,
          });
          resetProcessing += 1;
        } catch (err) {
          this.logger.warn(
            `Failed to reset PROCESSING claim ${claim.id}: ${err instanceof Error ? err.message : err}`,
          );
        }
      }

      // 2. Refund PENDING claims stuck beyond the stale window
      const stalePendingCutoff = new Date(Date.now() - PENDING_STALE_MS);
      const stalePending = await this.redemptionRepository.find({
        where: {
          status: 'PENDING',
          createdAt: LessThan(stalePendingCutoff),
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
