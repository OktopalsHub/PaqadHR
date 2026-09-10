import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPositionDeletedAt1788205216357 implements MigrationInterface {
  name = 'AddPositionDeletedAt1788205216357';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE position ADD COLUMN deleted_at TIMESTAMP NULL;');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE position DROP COLUMN deleted_at;');
  }
}
