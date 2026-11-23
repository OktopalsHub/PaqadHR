import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Interview1795450627653 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE interview (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          candidate_id uuid NOT NULL,
          job_opening_id uuid NOT NULL,
          type character varying(16) NOT NULL,
          status character varying(16) DEFAULT 'SCHEDULED'::character varying NOT NULL,
          date timestamp without time zone NOT NULL,
          duration integer NOT NULL,
          interviewers json NOT NULL,
          location character varying,
          feedback json,
          notes text,
          tenant_member_id uuid NOT NULL,
          tenant_id uuid NOT NULL,
          created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          deleted_at timestamp without time zone
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY interview
          ADD CONSTRAINT interview_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY interview
          ADD CONSTRAINT fk_interview_candidate FOREIGN KEY (candidate_id) REFERENCES candidate(id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY interview
          ADD CONSTRAINT fk_interview_job_opening FOREIGN KEY (job_opening_id) REFERENCES job_opening(id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY interview
          ADD CONSTRAINT fk_interview_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY interview
          ADD CONSTRAINT fk_interview_tenant_member FOREIGN KEY (tenant_member_id) REFERENCES tenant_members(id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "interview";`);
  }
}
