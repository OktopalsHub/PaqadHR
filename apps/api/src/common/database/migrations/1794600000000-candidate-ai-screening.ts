import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CandidateAiScreening1794600000000 implements MigrationInterface {
  name = 'CandidateAiScreening1794600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE candidate ADD COLUMN ai_screening jsonb');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE candidate DROP COLUMN IF EXISTS ai_screening');
  }
}
