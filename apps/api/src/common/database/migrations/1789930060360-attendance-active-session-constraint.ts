import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AttendanceActiveSessionConstraint1789930060360 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM attendances
          WHERE session_status = 'ACTIVE'
          GROUP BY tenant_id, tenant_member_id, date
          HAVING COUNT(*) > 1
        ) THEN
          RAISE EXCEPTION
            'Cannot create uq_attendance_active_session: duplicate ACTIVE attendance sessions exist; remediate duplicates before deployment';
        END IF;
      END $$;
    `);

    await queryRunner.query(
      "CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_active_session ON attendances (tenant_id, tenant_member_id, date) WHERE session_status = 'ACTIVE';",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS uq_attendance_active_session;');
  }
}
