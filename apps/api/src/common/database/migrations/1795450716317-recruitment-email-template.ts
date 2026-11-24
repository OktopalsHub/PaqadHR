import type { MigrationInterface, QueryRunner } from 'typeorm';

export class RecruitmentEmailTemplate1795450716317 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE recruitment_email_template (
          id uuid DEFAULT gen_random_uuid() NOT NULL,
          created_at timestamp without time zone DEFAULT now() NOT NULL,
          updated_at timestamp without time zone DEFAULT now() NOT NULL,
          tenant_id uuid NOT NULL,
          name character varying(120) NOT NULL,
          subject character varying(255) NOT NULL,
          body_html text NOT NULL,
          is_active boolean DEFAULT true NOT NULL,
          created_by_member_id uuid
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY recruitment_email_template
          ADD CONSTRAINT recruitment_email_template_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_recruitment_email_template_tenant ON recruitment_email_template USING btree (tenant_id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY recruitment_email_template
          ADD CONSTRAINT recruitment_email_template_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "recruitment_email_template";`);
  }
}
