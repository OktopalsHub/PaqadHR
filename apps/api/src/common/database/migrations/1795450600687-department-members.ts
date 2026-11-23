import type { MigrationInterface, QueryRunner } from 'typeorm';

export class DepartmentMembers1795450600687 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE department_members (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          department_id uuid NOT NULL,
          member_id uuid NOT NULL,
          role character varying(50),
          joined_at date,
          is_active boolean DEFAULT true,
          created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY department_members
          ADD CONSTRAINT department_members_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY department_members
          ADD CONSTRAINT unique_department_member UNIQUE (department_id, member_id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY department_members
          ADD CONSTRAINT fk_department_members_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY department_members
          ADD CONSTRAINT fk_department_members_member FOREIGN KEY (member_id) REFERENCES tenant_members(id) ON DELETE CASCADE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "department_members";`);
  }
}
