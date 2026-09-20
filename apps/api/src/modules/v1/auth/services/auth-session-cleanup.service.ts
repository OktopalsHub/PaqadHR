import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Session } from '../entities/session.entity';

const SESSION_CLEANUP_BATCH_SIZE = 1000;

@Injectable()
export class AuthSessionCleanupService {
  private readonly logger = new Logger(AuthSessionCleanupService.name);

  constructor(
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
  ) {}

  @Cron('0 * * * *', { name: 'auth-session-cleanup' })
  async cleanupExpiredSessions(): Promise<void> {
    let deleted = 0;

    do {
      const result = await this.sessionRepository
        .createQueryBuilder()
        .delete()
        .from(Session)
        .where(
          'id IN (SELECT id FROM session WHERE expires_at <= :now ORDER BY expires_at ASC LIMIT :limit)',
        )
        .setParameters({ now: new Date(), limit: SESSION_CLEANUP_BATCH_SIZE })
        .execute();

      deleted = result.affected ?? 0;
    } while (deleted === SESSION_CLEANUP_BATCH_SIZE);

    if (deleted > 0) {
      this.logger.log('Removed ' + deleted + ' expired auth sessions');
    }
  }
}
