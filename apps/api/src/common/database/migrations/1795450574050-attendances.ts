import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Attendances1795450574050 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE attendances (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          tenant_id uuid NOT NULL,
          tenant_member_id uuid NOT NULL,
          date date NOT NULL,
          clock_in timestamp without time zone,
          clock_out timestamp without time zone,
          work_hours character varying(10),
          status character varying(16) DEFAULT 'ABSENT'::character varying NOT NULL,
          session_status character varying(16) DEFAULT 'CLOSED'::character varying NOT NULL,
          session_number integer DEFAULT 1 NOT NULL,
          notes text,
          location character varying(255),
          ip_address character varying(45),
          user_agent character varying(255),
          device_type character varying(50),
          entry_method character varying(50),
          is_manual_entry boolean DEFAULT false NOT NULL,
          approved_by_id uuid,
          approved_at timestamp without time zone,
          created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY attendances
          ADD CONSTRAINT attendances_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_attendance_date ON attendances USING btree (date);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_attendance_member_date ON attendances USING btree (tenant_member_id, date);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_attendance_tenant_id ON attendances USING btree (tenant_id);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_attendance_tenant_member_id ON attendances USING btree (tenant_member_id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY attendances
          ADD CONSTRAINT fk_attendances_approved_by FOREIGN KEY (approved_by_id) REFERENCES tenant_members(id) ON DELETE SET NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY attendances
          ADD CONSTRAINT fk_attendances_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY attendances
          ADD CONSTRAINT fk_attendances_tenant_member FOREIGN KEY (tenant_member_id) REFERENCES tenant_members(id) ON DELETE CASCADE;
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_attendance_active_session ON attendances (tenant_id, tenant_member_id, date) WHERE session_status = 'ACTIVE';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "attendances";`);
  }
}
