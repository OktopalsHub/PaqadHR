import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PaymentMethodSubmittedAtAndSecurityBackfill1787870704946
  implements MigrationInterface
{
  name = 'PaymentMethodSubmittedAtAndSecurityBackfill1787870704946';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE payment_methods
      ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP NULL
    `);

    await queryRunner.query(`
      INSERT INTO payment_security (
        id,
        member_id,
        payment_passcode,
        passcode_attempts,
        passcode_locked_until,
        created_at,
        updated_at
      )
      SELECT
        uuid_generate_v4(),
        pm.member_id,
        pm.passcode_hash,
        0,
        NULL,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      FROM (
        SELECT DISTINCT ON (member_id)
          member_id,
          passcode_hash
        FROM payment_methods
        WHERE passcode_hash IS NOT NULL
          AND passcode_hash <> ''
        ORDER BY member_id, created_at ASC
      ) pm
      WHERE NOT EXISTS (
        SELECT 1 FROM payment_security ps WHERE ps.member_id = pm.member_id
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE payment_methods
      DROP COLUMN IF EXISTS submitted_at
    `);
  }
}
