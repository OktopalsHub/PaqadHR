import type { MigrationInterface, QueryRunner } from 'typeorm';

export class JobOpening1795450583233 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE job_opening (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          title character varying NOT NULL,
          department_id uuid,
          "position" character varying NOT NULL,
          employment_type character varying(16) NOT NULL,
          experience_level character varying(50) DEFAULT 'Mid-Level'::character varying,
          location json NOT NULL,
          description text NOT NULL,
          requirements json NOT NULL,
          responsibilities json NOT NULL,
          preferred_qualifications json,
          required_skills json,
          minimum_salary numeric(10,2),
          maximum_salary numeric(10,2),
          currency character varying,
          benefits json,
          status character varying(16) DEFAULT 'DRAFT'::character varying NOT NULL,
          is_urgent boolean DEFAULT false NOT NULL,
          published_at timestamp without time zone,
          closed_at timestamp without time zone,
          custom_questions json,
          hiring_manager_id uuid,
          number_of_openings integer,
          application_deadline timestamp without time zone,
          tenant_member_id uuid NOT NULL,
          tenant_id uuid NOT NULL,
          created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          deleted_at timestamp without time zone
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY job_opening
          ADD CONSTRAINT job_opening_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_job_opening_tenant ON job_opening USING btree (tenant_id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY job_opening
          ADD CONSTRAINT fk_job_opening_department FOREIGN KEY (department_id) REFERENCES departments(id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY job_opening
          ADD CONSTRAINT fk_job_opening_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY job_opening
          ADD CONSTRAINT fk_job_opening_tenant_member FOREIGN KEY (tenant_member_id) REFERENCES tenant_members(id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "job_opening";`);
  }
}
