import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PlanPrices1781241209906 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE plan_prices (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        plan_id UUID NOT NULL,
        currency VARCHAR(3) NOT NULL,
        country_code VARCHAR(10) DEFAULT 'GLOBAL',
        monthly_price DECIMAL(12,2) NOT NULL,
        yearly_price DECIMAL(12,2) DEFAULT 0,
        nomba_plan_id VARCHAR(100),
        regional_config JSONB DEFAULT '{}',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT fk_plan_prices_plan FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_plan_prices_plan_country_currency ON plan_prices(plan_id, country_code, currency);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE plan_prices;`);
  }
}
