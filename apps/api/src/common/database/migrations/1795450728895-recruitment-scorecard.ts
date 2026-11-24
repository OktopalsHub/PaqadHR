import type { MigrationInterface, QueryRunner } from 'typeorm';

export class RecruitmentScorecard1795450728895 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE recruitment_scorecard (
          id uuid DEFAULT gen_random_uuid() NOT NULL,
          created_at timestamp without time zone DEFAULT now() NOT NULL,
          updated_at timestamp without time zone DEFAULT now() NOT NULL,
          tenant_id uuid NOT NULL,
          candidate_id uuid NOT NULL,
          reviewer_member_id uuid NOT NULL,
          ratings jsonb NOT NULL,
          recommendation character varying(16) NOT NULL,
          notes text,
          CONSTRAINT ck_recruitment_scorecard_recommendation CHECK (((recommendation)::text = ANY ((ARRAY['STRONG_YES'::character varying, 'YES'::character varying, 'NO'::character varying, 'STRONG_NO'::character varying])::text[])))
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY recruitment_scorecard
          ADD CONSTRAINT recruitment_scorecard_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY recruitment_scorecard
          ADD CONSTRAINT uq_recruitment_scorecard_reviewer UNIQUE (candidate_id, reviewer_member_id);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_recruitment_scorecard_candidate ON recruitment_scorecard USING btree (tenant_id, candidate_id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY recruitment_scorecard
          ADD CONSTRAINT recruitment_scorecard_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES candidate(id) ON DELETE CASCADE;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY recruitment_scorecard
          ADD CONSTRAINT recruitment_scorecard_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "recruitment_scorecard";`);
  }
}
