import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Teams1795450760591 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE teams (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          name character varying(100) NOT NULL,
          description text,
          department_id uuid,
          lead_id uuid,
          tenant_id uuid NOT NULL,
          created_by uuid NOT NULL,
          created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY teams
          ADD CONSTRAINT teams_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY teams
          ADD CONSTRAINT fk_teams_created_by FOREIGN KEY (created_by) REFERENCES tenant_members(id) ON DELETE CASCADE;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY teams
          ADD CONSTRAINT fk_teams_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY teams
          ADD CONSTRAINT fk_teams_lead FOREIGN KEY (lead_id) REFERENCES tenant_members(id) ON DELETE SET NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY teams
          ADD CONSTRAINT fk_teams_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "teams";`);
  }
}
