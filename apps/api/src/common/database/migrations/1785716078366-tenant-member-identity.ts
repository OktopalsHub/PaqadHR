import type { MigrationInterface, QueryRunner } from 'typeorm';

export class TenantMemberIdentity1785716078366 implements MigrationInterface {
  name = 'TenantMemberIdentity1785716078366';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tenant_members
        ADD COLUMN IF NOT EXISTS identity_bvn VARCHAR,
        ADD COLUMN IF NOT EXISTS identity_nin VARCHAR;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tenant_members
        DROP COLUMN IF EXISTS identity_nin,
        DROP COLUMN IF EXISTS identity_bvn;
    `);
  }
}
