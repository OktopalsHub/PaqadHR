import type { MigrationInterface, QueryRunner } from 'typeorm';

export class LeaveReportIndex1794800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_leaves_tenant_member_status ON leaves (tenant_id, requested_by, status);`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_leaves_tenant_member_status;`);
  }
}
