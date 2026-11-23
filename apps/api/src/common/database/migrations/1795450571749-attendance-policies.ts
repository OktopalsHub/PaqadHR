import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AttendancePolicies1795450571749 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE attendance_policies (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          name character varying(100) NOT NULL,
          description text NOT NULL,
          work_start_time time without time zone NOT NULL,
          work_end_time time without time zone NOT NULL,
          late_threshold integer NOT NULL,
          half_day_threshold integer NOT NULL,
          grace_period integer NOT NULL,
          max_sessions_per_day integer DEFAULT 3 NOT NULL,
          is_active boolean DEFAULT true NOT NULL,
          tenant_id uuid NOT NULL,
          created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY attendance_policies
          ADD CONSTRAINT attendance_policies_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY attendance_policies
          ADD CONSTRAINT fk_attendance_policies_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "attendance_policies";`);
  }
}
