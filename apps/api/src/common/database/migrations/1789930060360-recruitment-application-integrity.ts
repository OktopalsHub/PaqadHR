import type { MigrationInterface, QueryRunner } from 'typeorm';

export class RecruitmentApplicationIntegrity1789930060360 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS uq_candidate_job_email ON candidate (job_opening_id, lower(email));',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS uq_candidate_job_email;');
  }
}
