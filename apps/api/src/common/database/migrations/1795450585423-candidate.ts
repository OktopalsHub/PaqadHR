import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Candidate1795450585423 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE candidate (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          job_opening_id uuid NOT NULL,
          first_name character varying NOT NULL,
          last_name character varying NOT NULL,
          email character varying NOT NULL,
          phone character varying NOT NULL,
          resume json NOT NULL,
          cover_letter json,
          cover_letter_text text,
          status character varying(16) DEFAULT 'APPLIED'::character varying NOT NULL,
          current_stage json NOT NULL,
          interview_schedule json,
          tenant_id uuid NOT NULL,
          source character varying(16) DEFAULT 'PUBLIC_WEBSITE'::character varying NOT NULL,
          applied_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
          withdrawn_at timestamp without time zone,
          location json,
          portfolio_url text,
          linkedin_url text,
          github_url text,
          skills text,
          experience json,
          created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          deleted_at timestamp without time zone,
          custom_answers jsonb,
          stage_id uuid,
          ai_screening jsonb,
          talent_pool boolean DEFAULT false NOT NULL
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY candidate
          ADD CONSTRAINT candidate_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_candidate_tenant_applied ON candidate USING btree (tenant_id, applied_at DESC);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_candidate_tenant_status ON candidate USING btree (tenant_id, status);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY candidate
          ADD CONSTRAINT fk_candidate_job_opening FOREIGN KEY (job_opening_id) REFERENCES job_opening(id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY candidate
          ADD CONSTRAINT fk_candidate_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id);
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_candidate_job_email ON candidate (job_opening_id, lower(email));
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "candidate";`);
  }
}
