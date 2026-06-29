import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AttendanceExceptions1781241262038 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE attendance_exceptions (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        date DATE NOT NULL,
        type VARCHAR(16) NOT NULL,
        reason TEXT NOT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
        approved_at TIMESTAMP,
        tenant_member_id UUID NOT NULL,
        approved_by_id UUID,
        tenant_id UUID NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT fk_attendance_exceptions_tenant_member FOREIGN KEY (tenant_member_id) REFERENCES tenant_members(id) ON DELETE CASCADE,
        CONSTRAINT fk_attendance_exceptions_approved_by FOREIGN KEY (approved_by_id) REFERENCES tenant_members(id) ON DELETE SET NULL,
        CONSTRAINT fk_attendance_exceptions_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE attendance_exceptions;`);
  }
}
