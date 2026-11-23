import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PlanPrices1795450692627 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE plan_prices (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          plan_id uuid NOT NULL,
          currency character varying(3) NOT NULL,
          country_code character varying(10) DEFAULT 'GLOBAL'::character varying,
          monthly_price numeric(12,2) NOT NULL,
          yearly_price numeric(12,2) DEFAULT 0,
          nomba_plan_id character varying(100),
          regional_config jsonb DEFAULT '{}'::jsonb,
          is_active boolean DEFAULT true,
          created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          bachs_product_id character varying(100)
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY plan_prices
          ADD CONSTRAINT plan_prices_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_plan_prices_plan_country_currency ON plan_prices USING btree (plan_id, country_code, currency);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY plan_prices
          ADD CONSTRAINT fk_plan_prices_plan FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "plan_prices";`);
  }
}
