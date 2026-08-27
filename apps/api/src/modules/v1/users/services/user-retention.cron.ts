import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { runCronJob } from 'src/common/utils/cron-logging.util';
import { LessThan, Repository } from 'typeorm';
import { TenantMember } from '../../tenant-members/entities/tenant-member.entity';
import { User } from '../entities/user.entity';

const USER_HARD_DELETE_DAYS = Number(process.env.USER_HARD_DELETE_DAYS ?? 30);

@Injectable()
export class UserRetentionCronService {
  private readonly logger = new Logger(UserRetentionCronService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(TenantMember)
    private readonly tenantMemberRepository: Repository<TenantMember>,
  ) {}

  @Cron(CronExpression.EVERY_WEEK)
  async hardDeleteExpiredUsers(): Promise<void> {
    await runCronJob(this.logger, 'user-retention', async () => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - USER_HARD_DELETE_DAYS);

      // Find soft-deleted users beyond grace period
      const expiredUsers = await this.userRepository.find({
        where: { deletedAt: LessThan(cutoff) } as unknown as Record<string, unknown>,
        withDeleted: true,
        take: 100,
        select: ['id'] as unknown as string[],
      });

      let purged = 0;
      for (const user of expiredUsers) {
        // Hard-delete tenant members already soft-deleted
        await this.tenantMemberRepository
          .createQueryBuilder()
          .delete()
          .from(TenantMember)
          .where('user_id = :userId', { userId: user.id })
          .andWhere('deleted_at IS NOT NULL')
          .execute();
        // Hard-delete user
        await this.userRepository
          .createQueryBuilder()
          .delete()
          .from(User)
          .where('id = :id', { id: user.id })
          .execute();
        purged += 1;
      }
      return { purged };
    });
  }
}
