import type { MigrationInterface, QueryRunner } from 'typeorm';

export class TenantCounters1795450764715 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE tenant_counters (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          tenant_id uuid NOT NULL,
          counter_type character varying(50) NOT NULL,
          current_value integer DEFAULT 0 NOT NULL,
          prefix character varying(10),
          suffix character varying(10),
          padding_length integer DEFAULT 3,
          created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY tenant_counters
          ADD CONSTRAINT tenant_counters_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY tenant_counters
          ADD CONSTRAINT unique_tenant_counter_type UNIQUE (tenant_id, counter_type);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_tenant_counters_lookup ON tenant_counters USING btree (tenant_id, counter_type);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY tenant_counters
          ADD CONSTRAINT fk_tenant_counters_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "tenant_counters";`);
  }
}
