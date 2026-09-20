import type { MigrationInterface, QueryRunner } from 'typeorm';

export class RecruitmentApplicationIntegrity1789930060360 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM candidate
          GROUP BY job_opening_id, lower(email)
          HAVING COUNT(*) > 1
        ) THEN
          RAISE EXCEPTION
            'Cannot create uq_candidate_job_email: duplicate applications exist; remediate duplicates before deployment';
        END IF;
      END $$;
    `);

    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS uq_candidate_job_email ON candidate (job_opening_id, lower(email));',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS uq_candidate_job_email;');
  }
}
