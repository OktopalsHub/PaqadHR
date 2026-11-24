import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Tenants1795450559848 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE tenants (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          name character varying(50) NOT NULL,
          slug character varying(25) NOT NULL,
          is_active boolean DEFAULT true NOT NULL,
          invite_code character varying(6) NOT NULL,
          employee_code character varying(10),
          logo_key character varying(100),
          industry character varying(50),
          company_size character varying(50),
          location character varying(100),
          country_code character varying(2),
          timezone character varying(50) DEFAULT 'UTC'::character varying,
          preferred_currency character varying(3),
          pricing_locked boolean DEFAULT false,
          created_by uuid NOT NULL,
          created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          deleted_at timestamp without time zone
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY tenants
          ADD CONSTRAINT tenants_invite_code_key UNIQUE (invite_code);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY tenants
          ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY tenants
          ADD CONSTRAINT tenants_slug_key UNIQUE (slug);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_tenant_is_active ON tenants USING btree (is_active);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY tenants
          ADD CONSTRAINT fk_tenants_created_by FOREIGN KEY (created_by) REFERENCES "user"(id) ON DELETE SET NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "tenants";`);
  }
}
