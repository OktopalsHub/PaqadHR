import type { MigrationInterface, QueryRunner } from 'typeorm';

export class RewardsJsonColumns1787008579275 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new JSON columns
    await queryRunner.query(`
      ALTER TABLE reward_redemptions
      ADD COLUMN recipient JSONB,
      ADD COLUMN voucher JSONB,
      ADD COLUMN provider_ref JSONB,
      ADD COLUMN processing_started_at TIMESTAMPTZ;
    `);

    // Migrate data from old columns to new JSON columns (strip NULL keys)
    await queryRunner.query(`
      UPDATE reward_redemptions
      SET recipient = jsonb_strip_nulls(jsonb_build_object(
        'email', recipient_email,
        'phone', recipient_phone
      ))
      WHERE recipient_email IS NOT NULL OR recipient_phone IS NOT NULL;
    `);

    await queryRunner.query(`
      UPDATE reward_redemptions
      SET voucher = jsonb_strip_nulls(jsonb_build_object(
        'code', voucher_code,
        'pin', voucher_pin,
        'instructions', voucher_instructions
      ))
      WHERE voucher_code IS NOT NULL OR voucher_pin IS NOT NULL OR voucher_instructions IS NOT NULL;
    `);

    await queryRunner.query(`
      UPDATE reward_redemptions
      SET provider_ref = jsonb_strip_nulls(jsonb_build_object(
        'txRef', provider_tx_ref,
        'error', error_message
      ))
      WHERE provider_tx_ref IS NOT NULL OR error_message IS NOT NULL;
    `);

    // Drop old columns
    await queryRunner.query(`
      ALTER TABLE reward_redemptions
      DROP COLUMN recipient_email,
      DROP COLUMN recipient_phone,
      DROP COLUMN voucher_code,
      DROP COLUMN voucher_pin,
      DROP COLUMN voucher_instructions,
      DROP COLUMN provider_tx_ref,
      DROP COLUMN error_message;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Normalize PROCESSING status before rollback (old code has no PROCESSING state)
    await queryRunner.query(`
      UPDATE reward_redemptions
      SET status = 'PENDING'
      WHERE status = 'PROCESSING';
    `);

    // Add back old columns
    await queryRunner.query(`
      ALTER TABLE reward_redemptions
      ADD COLUMN recipient_email VARCHAR,
      ADD COLUMN recipient_phone VARCHAR,
      ADD COLUMN voucher_code TEXT,
      ADD COLUMN voucher_pin TEXT,
      ADD COLUMN voucher_instructions TEXT,
      ADD COLUMN provider_tx_ref VARCHAR,
      ADD COLUMN error_message TEXT;
    `);

    // Migrate data from JSON columns back to old columns
    await queryRunner.query(`
      UPDATE reward_redemptions
      SET
        recipient_email = recipient->>'email',
        recipient_phone = recipient->>'phone'
      WHERE recipient IS NOT NULL;
    `);

    await queryRunner.query(`
      UPDATE reward_redemptions
      SET
        voucher_code = voucher->>'code',
        voucher_pin = voucher->>'pin',
        voucher_instructions = voucher->>'instructions'
      WHERE voucher IS NOT NULL;
    `);

    await queryRunner.query(`
      UPDATE reward_redemptions
      SET
        provider_tx_ref = provider_ref->>'txRef',
        error_message = provider_ref->>'error'
      WHERE provider_ref IS NOT NULL;
    `);

    // Drop JSON columns
    await queryRunner.query(`
      ALTER TABLE reward_redemptions
      DROP COLUMN recipient,
      DROP COLUMN voucher,
      DROP COLUMN provider_ref,
      DROP COLUMN processing_started_at;
    `);
  }
}
