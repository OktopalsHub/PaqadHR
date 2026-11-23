import type { MigrationInterface, QueryRunner } from 'typeorm';

export class TenantSettings1795450766633 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE tenant_settings (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          tenant_id uuid NOT NULL,
          settings jsonb DEFAULT '{}'::jsonb NOT NULL,
          created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY tenant_settings
          ADD CONSTRAINT tenant_settings_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_tenant_settings_tenant_id ON tenant_settings USING btree (tenant_id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY tenant_settings
          ADD CONSTRAINT fk_tenant_settings_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "tenant_settings";`);
  }
}
