import type { MigrationInterface, QueryRunner } from 'typeorm';

export class WalletProviderWebhookEvents1793200000000 implements MigrationInterface {
  name = 'WalletProviderWebhookEvents1793200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE wallet_provider_webhook_events (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        provider varchar(24) NOT NULL,
        event_id varchar(255) NOT NULL,
        event_type varchar(100) NOT NULL,
        event_object_id varchar(255) NULL,
        received_at timestamp NOT NULL DEFAULT now(),
        processed_at timestamp NULL,
        CONSTRAINT uq_wallet_provider_webhook_event UNIQUE (provider, event_id)
      );
      CREATE INDEX ix_wallet_provider_webhook_received
        ON wallet_provider_webhook_events (received_at) WHERE processed_at IS NULL;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const [{ count }] = (await queryRunner.query(
      'SELECT COUNT(*)::text AS count FROM wallet_provider_webhook_events',
    )) as Array<{ count: string }>;
    if (Number(count) > 0) {
      throw new Error('Refusing to drop populated wallet provider webhook evidence.');
    }
    await queryRunner.query('DROP TABLE wallet_provider_webhook_events');
  }
}
