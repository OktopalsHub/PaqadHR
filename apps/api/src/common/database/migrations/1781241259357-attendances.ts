import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Attendances1781241259357 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE attendances (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL,
        tenant_member_id UUID NOT NULL,
        date DATE NOT NULL,
        clock_in TIMESTAMP,
        clock_out TIMESTAMP,
        work_hours VARCHAR(10),
        status VARCHAR(16) NOT NULL DEFAULT 'ABSENT',
        session_status VARCHAR(16) NOT NULL DEFAULT 'CLOSED',
        session_number INTEGER NOT NULL DEFAULT 1,
        notes TEXT,
        location VARCHAR(255),
        ip_address VARCHAR(45),
        user_agent VARCHAR(255),
        device_type VARCHAR(50),
        entry_method VARCHAR(50),
        is_manual_entry BOOLEAN NOT NULL DEFAULT false,
        approved_by_id UUID,
        approved_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT fk_attendances_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
        CONSTRAINT fk_attendances_tenant_member FOREIGN KEY (tenant_member_id) REFERENCES tenant_members(id) ON DELETE CASCADE,
        CONSTRAINT fk_attendances_approved_by FOREIGN KEY (approved_by_id) REFERENCES tenant_members(id) ON DELETE SET NULL
      );
    `);

    await queryRunner.query(`
      CREATE INDEX idx_attendance_tenant_id ON attendances(tenant_id);
      CREATE INDEX idx_attendance_tenant_member_id ON attendances(tenant_member_id);
      CREATE INDEX idx_attendance_date ON attendances(date);
      CREATE INDEX idx_attendance_member_date ON attendances(tenant_member_id, date);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE attendances;`);
  }
}
