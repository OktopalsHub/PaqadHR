import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Invitations1795450631975 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE invitations (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          email character varying(100) NOT NULL,
          tenant_id uuid NOT NULL,
          first_name character varying(50),
          last_name character varying(50),
          middle_name character varying(50),
          job_title character varying(100),
          department_id uuid,
          employment_type character varying(50),
          employee_number character varying(20),
          position_id uuid,
          role character varying(32) DEFAULT 'member'::character varying NOT NULL,
          status character varying(16) DEFAULT 'pending'::character varying NOT NULL,
          invited_by uuid NOT NULL,
          token character varying(255) NOT NULL,
          expires_at timestamp without time zone NOT NULL,
          created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          deleted_at timestamp without time zone
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY invitations
          ADD CONSTRAINT invitations_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY invitations
          ADD CONSTRAINT invitations_token_key UNIQUE (token);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_invitations_tenant_id ON invitations USING btree (tenant_id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY invitations
          ADD CONSTRAINT fk_invitations_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY invitations
          ADD CONSTRAINT fk_invitations_invited_by FOREIGN KEY (invited_by) REFERENCES tenant_members(id) ON DELETE CASCADE;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY invitations
          ADD CONSTRAINT fk_invitations_position FOREIGN KEY (position_id) REFERENCES "position"(id) ON DELETE SET NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY invitations
          ADD CONSTRAINT fk_invitations_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "invitations";`);
  }
}
