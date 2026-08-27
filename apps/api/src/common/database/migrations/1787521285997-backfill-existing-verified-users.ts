import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Accounts created before email verification was enforced were allowed to sign
 * in without proving ownership of their email address. Preserve that legacy
 * access when the new verification guard is deployed; accounts created after
 * this migration retain the column's false default and must verify by OTP.
 */
export class BackfillExistingVerifiedUsers1787521285997 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // CURRENT_TIMESTAMP is fixed at the migration transaction's start. This
    // identifies legacy accounts without taking a table lock that blocks new
    // registrations while the one-time backfill runs.
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
