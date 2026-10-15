import type { MigrationInterface, QueryRunner } from 'typeorm';

export class DropAssetManagement1783110763106 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS asset_maintenance;`);
    await queryRunner.query(`DROP TABLE IF EXISTS asset_documents;`);
    await queryRunner.query(`DROP TABLE IF EXISTS asset_assignments;`);
    await queryRunner.query(`DROP TABLE IF EXISTS assets;`);
    await queryRunner.query(`DROP TABLE IF EXISTS asset_categories;`);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Asset management was removed; recreate via historical migrations if needed.
  }
}
