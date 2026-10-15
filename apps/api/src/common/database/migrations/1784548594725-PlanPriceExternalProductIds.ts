import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PlanPriceExternalProductIds1784548594725 implements MigrationInterface {
  name = 'PlanPriceExternalProductIds1784548594725';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE plan_prices
        ADD COLUMN IF NOT EXISTS bachs_product_id VARCHAR(100) NULL,
        ADD COLUMN IF NOT EXISTS polar_product_id VARCHAR(100) NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE plan_prices
        DROP COLUMN IF EXISTS polar_product_id,
        DROP COLUMN IF EXISTS bachs_product_id;
    `);
  }
}
