import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AttendanceExceptions1795450569503 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE attendance_exceptions (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          date date NOT NULL,
          type character varying(16) NOT NULL,
          reason text NOT NULL,
          status character varying(16) DEFAULT 'PENDING'::character varying NOT NULL,
          approved_at timestamp without time zone,
          tenant_member_id uuid NOT NULL,
          approved_by_id uuid,
          tenant_id uuid NOT NULL,
          created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY attendance_exceptions
          ADD CONSTRAINT attendance_exceptions_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY attendance_exceptions
          ADD CONSTRAINT fk_attendance_exceptions_approved_by FOREIGN KEY (approved_by_id) REFERENCES tenant_members(id) ON DELETE SET NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY attendance_exceptions
          ADD CONSTRAINT fk_attendance_exceptions_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY attendance_exceptions
          ADD CONSTRAINT fk_attendance_exceptions_tenant_member FOREIGN KEY (tenant_member_id) REFERENCES tenant_members(id) ON DELETE CASCADE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "attendance_exceptions";`);
  }
}
