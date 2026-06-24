import type { MigrationInterface, QueryRunner } from 'typeorm';

export class EmploymentPositionNullable1781549462131 implements MigrationInterface {
  name = 'EmploymentPositionNullable1781549462131';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE employment
        ALTER COLUMN position_id DROP NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE employment
        ALTER COLUMN position_id SET NOT NULL;
    `);
  }
}
