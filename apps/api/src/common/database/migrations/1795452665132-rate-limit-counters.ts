import type { MigrationInterface, QueryRunner } from 'typeorm';

export class RateLimitCounters1795452665132 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE rate_limit_counters (
          key character varying(255) NOT NULL,
          count integer NOT NULL,
          expires_at timestamp with time zone NOT NULL,
          CONSTRAINT rate_limit_counters_pkey PRIMARY KEY (key)
      );
    `);
    await queryRunner.query(`
      CREATE INDEX ix_rate_limit_counters_expires_at ON rate_limit_counters USING btree (expires_at);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "rate_limit_counters";`);
  }
}
