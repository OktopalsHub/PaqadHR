import type { MigrationInterface, QueryRunner } from 'typeorm';

export class MemberRecruitmentPreferences1795100000000 implements MigrationInterface {
  name = 'MemberRecruitmentPreferences1795100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE tenant_members ADD COLUMN IF NOT EXISTS recruitment_ask_email_on_move boolean NOT NULL DEFAULT true;`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE tenant_members DROP COLUMN IF EXISTS recruitment_ask_email_on_move;`,
    );
  }
}
