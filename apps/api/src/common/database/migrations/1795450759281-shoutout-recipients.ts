import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ShoutoutRecipients1795450759281 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE shoutout_recipients (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          tenant_id uuid NOT NULL,
          shoutout_id uuid NOT NULL,
          recipient_id uuid NOT NULL,
          points integer NOT NULL,
          created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY shoutout_recipients
          ADD CONSTRAINT shoutout_recipients_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY shoutout_recipients
          ADD CONSTRAINT fk_shoutout_recipients_recipient FOREIGN KEY (recipient_id) REFERENCES tenant_members(id) ON DELETE CASCADE;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY shoutout_recipients
          ADD CONSTRAINT fk_shoutout_recipients_shoutout FOREIGN KEY (shoutout_id) REFERENCES shoutouts(id) ON DELETE CASCADE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "shoutout_recipients";`);
  }
}
