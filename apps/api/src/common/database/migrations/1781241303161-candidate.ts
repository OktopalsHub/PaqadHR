import { MigrationInterface, QueryRunner } from 'typeorm';

export class Candidate1781241303161 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE candidate (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        job_opening_id UUID NOT NULL,
        first_name VARCHAR NOT NULL,
        last_name VARCHAR NOT NULL,
        email VARCHAR NOT NULL,
        phone VARCHAR NOT NULL,
        resume JSON NOT NULL,
        cover_letter JSON,
        cover_letter_text TEXT,
        status VARCHAR(16) NOT NULL DEFAULT 'APPLIED',
        current_stage JSON NOT NULL,
        interview_schedule JSON,
        tenant_id UUID NOT NULL,
        source VARCHAR(16) NOT NULL DEFAULT 'PUBLIC_WEBSITE',
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        withdrawn_at TIMESTAMP,
        location JSON,
        portfolio_url TEXT,
        linkedin_url TEXT,
        github_url TEXT,
        skills TEXT,
        experience JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT fk_candidate_job_opening FOREIGN KEY (job_opening_id) REFERENCES job_opening(id),
        CONSTRAINT fk_candidate_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE candidate;`);
  }
}
