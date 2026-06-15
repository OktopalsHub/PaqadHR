import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CandidateAssessment1781241308420 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE candidate_assessment (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        candidate_id UUID NOT NULL,
        assessment_id UUID NOT NULL,
        type VARCHAR NOT NULL,
        score INTEGER,
        completed_at TIMESTAMP,
        feedback TEXT,
        tenant_member_id UUID NOT NULL,
        tenant_id UUID NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT fk_candidate_assessment_candidate FOREIGN KEY (candidate_id) REFERENCES candidate(id) ON DELETE CASCADE,
        CONSTRAINT fk_candidate_assessment_assessment FOREIGN KEY (assessment_id) REFERENCES assessment(id) ON DELETE CASCADE,
        CONSTRAINT fk_candidate_assessment_tenant_member FOREIGN KEY (tenant_member_id) REFERENCES tenant_members(id),
        CONSTRAINT fk_candidate_assessment_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE candidate_assessment;`);
  }
}
