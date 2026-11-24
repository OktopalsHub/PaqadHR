import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CustomRewards1795450597919 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE custom_rewards (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          tenant_id uuid NOT NULL,
          title character varying NOT NULL,
          description text,
          points_cost integer NOT NULL,
          image_url character varying,
          is_active boolean DEFAULT true,
          stock_limit integer,
          delivery_instructions text,
          created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          deleted_at timestamp without time zone
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY custom_rewards
          ADD CONSTRAINT custom_rewards_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_custom_rewards_tenant_id ON custom_rewards USING btree (tenant_id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY custom_rewards
          ADD CONSTRAINT fk_custom_rewards_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "custom_rewards";`);
  }
}
