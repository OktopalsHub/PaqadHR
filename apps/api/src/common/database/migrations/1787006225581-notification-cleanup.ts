import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class NotificationCleanup1787006225581 implements MigrationInterface {
  name = 'NotificationCleanup1787006225581';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "notifications"
        DROP COLUMN IF EXISTS "emailTemplate",
        DROP COLUMN IF EXISTS "emailContext",
        DROP COLUMN IF EXISTS "emailSubject",
        DROP COLUMN IF EXISTS "errorMessage",
        DROP COLUMN IF EXISTS "retryCount"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "notifications"
        ADD COLUMN "emailTemplate" varchar,
        ADD COLUMN "emailContext" jsonb,
        ADD COLUMN "emailSubject" varchar,
        ADD COLUMN "errorMessage" text,
        ADD COLUMN "retryCount" integer NOT NULL DEFAULT 0
    `);
  }
}
