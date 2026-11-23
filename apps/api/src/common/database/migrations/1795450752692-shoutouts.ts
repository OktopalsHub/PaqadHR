import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Shoutouts1795450752692 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE shoutouts (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          tenant_id uuid NOT NULL,
          total_points integer DEFAULT 0,
          created_by uuid NOT NULL,
          message text NOT NULL,
          created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY shoutouts
          ADD CONSTRAINT shoutouts_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_shoutouts_tenant_id ON shoutouts USING btree (tenant_id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY shoutouts
          ADD CONSTRAINT fk_shoutouts_created_by FOREIGN KEY (created_by) REFERENCES tenant_members(id) ON DELETE SET NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY shoutouts
          ADD CONSTRAINT fk_shoutouts_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "shoutouts";`);
  }
}
