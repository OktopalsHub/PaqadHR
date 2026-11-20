import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PipelineStageColor1795000000000 implements MigrationInterface {
  name = 'PipelineStageColor1795000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE recruitment_pipeline_stage ADD COLUMN IF NOT EXISTS color varchar(7);`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE recruitment_pipeline_stage DROP COLUMN IF EXISTS color;`);
  }
}
