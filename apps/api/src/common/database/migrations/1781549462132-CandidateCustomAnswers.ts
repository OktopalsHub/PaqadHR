import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CandidateCustomAnswers1781549462132 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE candidate ADD COLUMN custom_answers JSONB;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE candidate DROP COLUMN custom_answers;
    `);
  }
}
