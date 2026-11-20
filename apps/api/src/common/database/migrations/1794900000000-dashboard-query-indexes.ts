import type { MigrationInterface, QueryRunner } from 'typeorm';

export class DashboardQueryIndexes1794900000000 implements MigrationInterface {
  name = 'DashboardQueryIndexes1794900000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_employment_reports_to ON employment (reports_to_id);
      CREATE INDEX IF NOT EXISTS idx_candidate_tenant_applied ON candidate (tenant_id, applied_at DESC);
      CREATE INDEX IF NOT EXISTS idx_candidate_tenant_status ON candidate (tenant_id, status);
      CREATE INDEX IF NOT EXISTS idx_leaves_tenant_start ON leaves (tenant_id, start_date DESC);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_leaves_tenant_start;
      DROP INDEX IF EXISTS idx_candidate_tenant_status;
      DROP INDEX IF EXISTS idx_candidate_tenant_applied;
      DROP INDEX IF EXISTS idx_employment_reports_to;
    `);
  }
}
