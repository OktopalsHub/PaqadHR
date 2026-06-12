import { MigrationInterface, QueryRunner } from 'typeorm';

export class Interview1781241313906 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE interview (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        candidate_id UUID NOT NULL,
        job_opening_id UUID NOT NULL,
        type VARCHAR(16) NOT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'SCHEDULED',
        date TIMESTAMP NOT NULL,
        duration INTEGER NOT NULL,
        interviewers JSON NOT NULL,
        location VARCHAR,
        feedback JSON,
        notes TEXT,
        tenant_member_id UUID NOT NULL,
        tenant_id UUID NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT fk_interview_candidate FOREIGN KEY (candidate_id) REFERENCES candidate(id),
        CONSTRAINT fk_interview_job_opening FOREIGN KEY (job_opening_id) REFERENCES job_opening(id),
        CONSTRAINT fk_interview_tenant_member FOREIGN KEY (tenant_member_id) REFERENCES tenant_members(id),
        CONSTRAINT fk_interview_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE interview;`);
  }
}
