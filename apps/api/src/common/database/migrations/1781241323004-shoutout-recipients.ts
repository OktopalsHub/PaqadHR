import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ShoutoutRecipients1781241323004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE shoutout_recipients (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL,
        shoutout_id UUID NOT NULL,
        recipient_id UUID NOT NULL,
        points INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT fk_shoutout_recipients_shoutout FOREIGN KEY (shoutout_id) REFERENCES shoutouts(id) ON DELETE CASCADE,
        CONSTRAINT fk_shoutout_recipients_recipient FOREIGN KEY (recipient_id) REFERENCES tenant_members(id) ON DELETE CASCADE
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE shoutout_recipients;`);
  }
}
