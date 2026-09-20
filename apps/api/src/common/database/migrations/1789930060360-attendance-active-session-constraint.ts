import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AttendanceActiveSessionConstraint1789930060360 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_active_session ON attendances (tenant_id, tenant_member_id, date) WHERE session_status = 'ACTIVE';",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS uq_attendance_active_session;');
  }
}
