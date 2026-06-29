import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddColorToDepartment1781550110123 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE departments ADD COLUMN color VARCHAR(20);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE departments DROP COLUMN color;
    `);
  }
}
