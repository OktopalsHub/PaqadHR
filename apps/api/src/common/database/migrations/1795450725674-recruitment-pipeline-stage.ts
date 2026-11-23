import type { MigrationInterface, QueryRunner } from 'typeorm';

export class RecruitmentPipelineStage1795450725674 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE recruitment_pipeline_stage (
          id uuid DEFAULT gen_random_uuid() NOT NULL,
          created_at timestamp without time zone DEFAULT now() NOT NULL,
          updated_at timestamp without time zone DEFAULT now() NOT NULL,
          tenant_id uuid NOT NULL,
          job_opening_id uuid,
          name character varying(80) NOT NULL,
          "position" integer NOT NULL,
          type character varying(16) NOT NULL,
          auto_email_template_id uuid,
          color character varying(7)
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY recruitment_pipeline_stage
          ADD CONSTRAINT recruitment_pipeline_stage_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_recruitment_pipeline_stage_scope ON recruitment_pipeline_stage USING btree (tenant_id, job_opening_id, "position");
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY recruitment_pipeline_stage
          ADD CONSTRAINT recruitment_pipeline_stage_auto_email_template_id_fkey FOREIGN KEY (auto_email_template_id) REFERENCES recruitment_email_template(id) ON DELETE SET NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY recruitment_pipeline_stage
          ADD CONSTRAINT recruitment_pipeline_stage_job_opening_id_fkey FOREIGN KEY (job_opening_id) REFERENCES job_opening(id) ON DELETE CASCADE;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY recruitment_pipeline_stage
          ADD CONSTRAINT recruitment_pipeline_stage_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "recruitment_pipeline_stage";`);
  }
}
