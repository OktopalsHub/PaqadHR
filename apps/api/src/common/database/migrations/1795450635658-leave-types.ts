import type { MigrationInterface, QueryRunner } from 'typeorm';

export class LeaveTypes1795450635658 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE leave_types (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          name character varying(100) NOT NULL,
          description text NOT NULL,
          default_days integer NOT NULL,
          is_active boolean DEFAULT true NOT NULL,
          tenant_id uuid NOT NULL,
          tenant_member_id uuid NOT NULL,
          created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          deleted_at timestamp without time zone
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY leave_types
          ADD CONSTRAINT leave_types_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY leave_types
          ADD CONSTRAINT fk_leave_types_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY leave_types
          ADD CONSTRAINT fk_leave_types_tenant_member FOREIGN KEY (tenant_member_id) REFERENCES tenant_members(id) ON DELETE SET NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "leave_types";`);
  }
}
