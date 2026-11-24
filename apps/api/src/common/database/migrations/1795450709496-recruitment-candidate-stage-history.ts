import type { MigrationInterface, QueryRunner } from 'typeorm';

export class RecruitmentCandidateStageHistory1795450709496 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE recruitment_candidate_stage_history (
          id uuid DEFAULT gen_random_uuid() NOT NULL,
          created_at timestamp without time zone DEFAULT now() NOT NULL,
          updated_at timestamp without time zone DEFAULT now() NOT NULL,
          tenant_id uuid NOT NULL,
          candidate_id uuid NOT NULL,
          from_stage_id uuid,
          to_stage_id uuid NOT NULL,
          actor_member_id uuid,
          reason character varying(500)
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY recruitment_candidate_stage_history
          ADD CONSTRAINT recruitment_candidate_stage_history_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_recruitment_stage_history_candidate ON recruitment_candidate_stage_history USING btree (tenant_id, candidate_id, created_at);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY recruitment_candidate_stage_history
          ADD CONSTRAINT recruitment_candidate_stage_history_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES candidate(id) ON DELETE CASCADE;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY recruitment_candidate_stage_history
          ADD CONSTRAINT recruitment_candidate_stage_history_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "recruitment_candidate_stage_history";`);
  }
}
