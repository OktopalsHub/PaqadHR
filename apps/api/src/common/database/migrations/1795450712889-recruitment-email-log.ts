import type { MigrationInterface, QueryRunner } from 'typeorm';

export class RecruitmentEmailLog1795450712889 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE recruitment_email_log (
          id uuid DEFAULT gen_random_uuid() NOT NULL,
          created_at timestamp without time zone DEFAULT now() NOT NULL,
          updated_at timestamp without time zone DEFAULT now() NOT NULL,
          tenant_id uuid NOT NULL,
          candidate_id uuid NOT NULL,
          template_id uuid,
          recipient_email character varying(255) NOT NULL,
          subject character varying(255) NOT NULL,
          status character varying(16) NOT NULL,
          error text,
          provider_message_id character varying(255),
          sent_by_member_id uuid,
          trigger character varying(24) DEFAULT 'manual'::character varying NOT NULL
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY recruitment_email_log
          ADD CONSTRAINT recruitment_email_log_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_recruitment_email_log_candidate ON recruitment_email_log USING btree (tenant_id, candidate_id, created_at);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY recruitment_email_log
          ADD CONSTRAINT recruitment_email_log_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES candidate(id) ON DELETE CASCADE;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY recruitment_email_log
          ADD CONSTRAINT recruitment_email_log_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "recruitment_email_log";`);
  }
}
