import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Runs a scheduled job on one API instance at a time: a Postgres session lock keeps other
 * replicas from starting the same sweep, and the in-process set keeps a slow tick from stacking.
 */
@Injectable()
export class CronClaimService {
  private readonly logger = new Logger(CronClaimService.name);
  private readonly running = new Set<string>();

  constructor(private readonly dataSource: DataSource) {}

  async runExclusive<T>(jobName: string, job: () => Promise<T>): Promise<T | undefined> {
    if (this.running.has(jobName)) {
      this.logger.debug(`[cron:overlap] ${jobName} is still running in this process`);
      return undefined;
    }
    this.running.add(jobName);

    const key = `cron:${jobName}`;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      const [{ locked }] = (await queryRunner.query(
        'SELECT pg_try_advisory_lock(hashtext($1)) AS locked',
        [key],
      )) as Array<{ locked: boolean }>;
      if (!locked) {
        this.logger.debug(`[cron:claimed] ${jobName} is running on another instance`);
        return undefined;
      }

      try {
        return await job();
      } finally {
        await queryRunner.query('SELECT pg_advisory_unlock(hashtext($1))', [key]);
      }
    } finally {
      this.running.delete(jobName);
      await queryRunner.release();
    }
  }
}
