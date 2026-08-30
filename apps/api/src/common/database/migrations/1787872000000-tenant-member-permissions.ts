import type { MigrationInterface, QueryRunner } from 'typeorm';

export class TenantMemberPermissions1787872000000 implements MigrationInterface {
  name = 'TenantMemberPermissions1787872000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tenant_members
      ADD COLUMN permissions VARCHAR[] NOT NULL DEFAULT '{}';
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE tenant_members DROP COLUMN permissions;');
  }
}
