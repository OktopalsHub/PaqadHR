import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class NotificationCleanup1787006225581 implements MigrationInterface {
  name = 'NotificationCleanup1787006225581';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "notifications"
        DROP COLUMN IF EXISTS "email_template",
        DROP COLUMN IF EXISTS "email_context",
        DROP COLUMN IF EXISTS "email_subject",
        DROP COLUMN IF EXISTS "error_message",
        DROP COLUMN IF EXISTS "retry_count"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "notifications"
        ADD COLUMN "email_template" varchar,
        ADD COLUMN "email_context" jsonb,
        ADD COLUMN "email_subject" varchar,
        ADD COLUMN "error_message" text,
        ADD COLUMN "retry_count" integer NOT NULL DEFAULT 0
    `);
  }
}
