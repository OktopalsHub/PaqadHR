import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddColorToPosition1781550110124 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "position" ADD COLUMN color VARCHAR(20);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "position" DROP COLUMN color;
    `);
  }
}
