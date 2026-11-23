import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Departments1795450580902 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE departments (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          name character varying(100) NOT NULL,
          description text,
          manager_id uuid,
          parent_id uuid,
          tenant_id uuid NOT NULL,
          created_by uuid NOT NULL,
          created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          color character varying(20)
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY departments
          ADD CONSTRAINT departments_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_departments_tenant_id ON departments USING btree (tenant_id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY departments
          ADD CONSTRAINT fk_departments_created_by FOREIGN KEY (created_by) REFERENCES tenant_members(id) ON DELETE SET NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY departments
          ADD CONSTRAINT fk_departments_manager FOREIGN KEY (manager_id) REFERENCES tenant_members(id) ON DELETE SET NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY departments
          ADD CONSTRAINT fk_departments_parent FOREIGN KEY (parent_id) REFERENCES departments(id) ON DELETE SET NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY departments
          ADD CONSTRAINT fk_departments_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "departments";`);
  }
}
