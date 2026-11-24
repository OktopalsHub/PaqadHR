import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CandidateAssessment1795450587884 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE candidate_assessment (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          candidate_id uuid NOT NULL,
          assessment_id uuid NOT NULL,
          type character varying NOT NULL,
          score integer,
          completed_at timestamp without time zone,
          feedback text,
          tenant_member_id uuid NOT NULL,
          tenant_id uuid NOT NULL,
          created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          deleted_at timestamp without time zone
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY candidate_assessment
          ADD CONSTRAINT candidate_assessment_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY candidate_assessment
          ADD CONSTRAINT fk_candidate_assessment_assessment FOREIGN KEY (assessment_id) REFERENCES assessment(id) ON DELETE CASCADE;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY candidate_assessment
          ADD CONSTRAINT fk_candidate_assessment_candidate FOREIGN KEY (candidate_id) REFERENCES candidate(id) ON DELETE CASCADE;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY candidate_assessment
          ADD CONSTRAINT fk_candidate_assessment_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY candidate_assessment
          ADD CONSTRAINT fk_candidate_assessment_tenant_member FOREIGN KEY (tenant_member_id) REFERENCES tenant_members(id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "candidate_assessment";`);
  }
}
