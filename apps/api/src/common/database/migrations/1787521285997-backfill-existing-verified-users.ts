import type { MigrationInterface, QueryRunner } from 'typeorm';

export class BackfillExistingVerifiedUsers1787521285997 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "user"
      SET email_verified = TRUE
      WHERE email_verified = FALSE
        AND created_at < CURRENT_TIMESTAMP;
    `);
  }

  public async down(): Promise<void> {
    // This is intentionally irreversible: reverting would also unverify users
    // who completed the email-verification flow after this migration ran.
  }
}
