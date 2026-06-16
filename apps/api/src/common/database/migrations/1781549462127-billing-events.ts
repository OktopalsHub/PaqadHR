import type { MigrationInterface, QueryRunner } from 'typeorm';

export class BillingEvents1781549462127 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE billing_events (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        event_id VARCHAR(255) NOT NULL,
        provider VARCHAR(32) NOT NULL,
        event_type VARCHAR(100) NOT NULL,
        payload JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      );
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_billing_events_event_provider
        ON billing_events(event_id, provider);
      CREATE INDEX idx_billing_events_created_at
        ON billing_events(created_at DESC);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE billing_events;`);
  }
}
