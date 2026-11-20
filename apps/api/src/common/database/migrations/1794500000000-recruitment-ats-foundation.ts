import type { MigrationInterface, QueryRunner } from 'typeorm';

export class RecruitmentAtsFoundation1794500000000 implements MigrationInterface {
  name = 'RecruitmentAtsFoundation1794500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE recruitment_email_template (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name varchar(120) NOT NULL,
        subject varchar(255) NOT NULL,
        body_html text NOT NULL,
        is_active boolean NOT NULL DEFAULT true,
        created_by_member_id uuid
      );
      CREATE INDEX idx_recruitment_email_template_tenant ON recruitment_email_template (tenant_id);

      CREATE TABLE recruitment_pipeline_stage (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        job_opening_id uuid REFERENCES job_opening(id) ON DELETE CASCADE,
        name varchar(80) NOT NULL,
        position int NOT NULL,
        type varchar(16) NOT NULL,
        auto_email_template_id uuid REFERENCES recruitment_email_template(id) ON DELETE SET NULL
      );
      CREATE INDEX idx_recruitment_pipeline_stage_scope
        ON recruitment_pipeline_stage (tenant_id, job_opening_id, position);

      CREATE TABLE recruitment_candidate_stage_history (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        candidate_id uuid NOT NULL REFERENCES candidate(id) ON DELETE CASCADE,
        from_stage_id uuid,
        to_stage_id uuid NOT NULL,
        actor_member_id uuid,
        reason varchar(500)
      );
      CREATE INDEX idx_recruitment_stage_history_candidate
        ON recruitment_candidate_stage_history (tenant_id, candidate_id, created_at);

      CREATE TABLE recruitment_email_log (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        candidate_id uuid NOT NULL REFERENCES candidate(id) ON DELETE CASCADE,
        template_id uuid,
        recipient_email varchar(255) NOT NULL,
        subject varchar(255) NOT NULL,
        status varchar(16) NOT NULL,
        error text,
        provider_message_id varchar(255),
        sent_by_member_id uuid,
        trigger varchar(24) NOT NULL DEFAULT 'manual'
      );
      CREATE INDEX idx_recruitment_email_log_candidate
        ON recruitment_email_log (tenant_id, candidate_id, created_at);

      ALTER TABLE candidate ADD COLUMN stage_id uuid;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE candidate DROP COLUMN IF EXISTS stage_id;
      DROP TABLE IF EXISTS recruitment_email_log;
      DROP TABLE IF EXISTS recruitment_candidate_stage_history;
      DROP TABLE IF EXISTS recruitment_pipeline_stage;
      DROP TABLE IF EXISTS recruitment_email_template;
    `);
  }
}
