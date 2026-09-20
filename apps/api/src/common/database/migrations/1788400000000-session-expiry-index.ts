import type { MigrationInterface, QueryRunner } from 'typeorm';

export class SessionExpiryIndex1788400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_session_expires_at ON session(expires_at);',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS idx_session_expires_at;');
  }
}
