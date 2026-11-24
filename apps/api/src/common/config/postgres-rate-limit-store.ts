import { Logger } from '@nestjs/common';
import { type ClientRateLimitInfo, MemoryStore, type Options, type Store } from 'express-rate-limit';
import type { DataSource } from 'typeorm';

/**
 * express-rate-limit store backed by the shared rate_limit_counters table, so the limit holds
 * across instances and restarts. A database error falls back to this process's memory.
 */
export class PostgresRateLimitStore implements Store {
  private readonly logger = new Logger(PostgresRateLimitStore.name);
  private readonly fallback = new MemoryStore();
  private windowMs = 60_000;
  localKeys = false;

  constructor(
    private readonly dataSource: DataSource,
    private readonly scope: string,
  ) {}

  init(options: Options): void {
    this.windowMs = options.windowMs;
    this.fallback.init(options);
  }

  private bucket(key: string): string {
    return `express:${this.scope}:${key}`;
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    try {
      const [row] = await this.dataSource.query(
        `INSERT INTO rate_limit_counters (key, count, expires_at)
         VALUES ($1, 1, now() + ($2 || ' milliseconds')::interval)
         ON CONFLICT (key) DO UPDATE SET
           count = CASE WHEN rate_limit_counters.expires_at <= now() THEN 1 ELSE rate_limit_counters.count + 1 END,
           expires_at = CASE WHEN rate_limit_counters.expires_at <= now()
             THEN now() + ($2 || ' milliseconds')::interval ELSE rate_limit_counters.expires_at END
         RETURNING count, expires_at`,
        [this.bucket(key), String(this.windowMs)],
      );
      return { totalHits: Number(row.count), resetTime: new Date(row.expires_at) };
    } catch (error) {
      this.logger.error(
        `Rate limit store unavailable, using memory: ${error instanceof Error ? error.message : error}`,
      );
      return this.fallback.increment(key);
    }
  }

  async decrement(key: string): Promise<void> {
    try {
      await this.dataSource.query(
        'UPDATE rate_limit_counters SET count = GREATEST(count - 1, 0) WHERE key = $1',
        [this.bucket(key)],
      );
    } catch {
      await this.fallback.decrement(key);
    }
  }

  async resetKey(key: string): Promise<void> {
    try {
      await this.dataSource.query('DELETE FROM rate_limit_counters WHERE key = $1', [
        this.bucket(key),
      ]);
    } catch {
      await this.fallback.resetKey(key);
    }
  }
}
