import type { MigrationInterface, QueryRunner } from 'typeorm';

export class WalletProviderWebhookEvents1795450775956 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE wallet_provider_webhook_events (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          created_at timestamp without time zone DEFAULT now() NOT NULL,
          updated_at timestamp without time zone DEFAULT now() NOT NULL,
          provider character varying(24) NOT NULL,
          event_id character varying(255) NOT NULL,
          event_type character varying(100) NOT NULL,
          event_object_id character varying(255),
          received_at timestamp without time zone DEFAULT now() NOT NULL,
          processed_at timestamp without time zone
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY wallet_provider_webhook_events
          ADD CONSTRAINT uq_wallet_provider_webhook_event UNIQUE (provider, event_id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY wallet_provider_webhook_events
          ADD CONSTRAINT wallet_provider_webhook_events_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      CREATE INDEX ix_wallet_provider_webhook_received ON wallet_provider_webhook_events USING btree (received_at) WHERE (processed_at IS NULL);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ count }] = (await queryRunner.query(
      'SELECT COUNT(*)::text AS count FROM wallet_provider_webhook_events',
    )) as Array<{ count: string }>;
    if (Number(count) > 0) {
      throw new Error(
        'Refusing to drop wallet_provider_webhook_events because it contains financial audit records. ' +
          'Export or archive them and run an explicitly approved retention migration first.',
      );
    }
    await queryRunner.query(`DROP TABLE IF EXISTS "wallet_provider_webhook_events";`);
  }
}
