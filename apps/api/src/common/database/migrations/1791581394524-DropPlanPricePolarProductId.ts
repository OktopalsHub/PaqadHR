import type { MigrationInterface, QueryRunner } from 'typeorm';

export class DropPlanPricePolarProductId1791581394524 implements MigrationInterface {
  name = 'DropPlanPricePolarProductId1791581394524';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE plan_prices
        DROP COLUMN IF EXISTS polar_product_id;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE plan_prices
        ADD COLUMN IF NOT EXISTS polar_product_id VARCHAR(100) NULL;
    `);
  }
}
