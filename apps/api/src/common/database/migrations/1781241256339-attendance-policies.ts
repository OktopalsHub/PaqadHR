import { MigrationInterface, QueryRunner } from 'typeorm';

export class AttendancePolicies1781241256339 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE attendance_policies (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        name VARCHAR(100) NOT NULL,
        description TEXT NOT NULL,
        work_start_time TIME NOT NULL,
        work_end_time TIME NOT NULL,
        late_threshold INTEGER NOT NULL,
        half_day_threshold INTEGER NOT NULL,
        grace_period INTEGER NOT NULL,
        max_sessions_per_day INTEGER NOT NULL DEFAULT 3,
        is_active BOOLEAN NOT NULL DEFAULT true,
        tenant_id UUID NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT fk_attendance_policies_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE attendance_policies;`);
  }
}
