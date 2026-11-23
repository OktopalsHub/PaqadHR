import type { MigrationInterface, QueryRunner } from 'typeorm';

export class TenantMembers1795450562359 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE tenant_members (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          first_name character varying(50),
          last_name character varying(50),
          middle_name character varying(50),
          preferred_name character varying(50),
          phone character varying(15),
          date_of_birth date,
          gender character varying(16),
          role character varying(16) DEFAULT 'MEMBER'::character varying NOT NULL,
          is_active boolean DEFAULT true NOT NULL,
          join_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
          leave_date timestamp without time zone,
          avatar_key character varying(100),
          user_id uuid NOT NULL,
          tenant_id uuid NOT NULL,
          employee_number character varying(7),
          created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          deleted_at timestamp without time zone,
          identity_bvn character varying,
          identity_nin character varying,
          recruitment_ask_email_on_move boolean DEFAULT true NOT NULL
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY tenant_members
          ADD CONSTRAINT tenant_members_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY tenant_members
          ADD CONSTRAINT uq_tenant_employee_number UNIQUE (tenant_id, employee_number);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_tenant_member_tenant_active ON tenant_members USING btree (tenant_id, is_active);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY tenant_members
          ADD CONSTRAINT fk_tenant_members_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY tenant_members
          ADD CONSTRAINT fk_tenant_members_user FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "tenant_members";`);
  }
}
