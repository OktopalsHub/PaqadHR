import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Employment1795450616308 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE employment (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          start_date date NOT NULL,
          end_date date,
          status character varying(16) DEFAULT 'active'::character varying NOT NULL,
          pay_type character varying(16) DEFAULT 'salary'::character varying NOT NULL,
          pay_schedule character varying(16) DEFAULT 'monthly'::character varying NOT NULL,
          pay_rate numeric(10,2) DEFAULT 0.00 NOT NULL,
          comments text,
          tenant_member_id uuid NOT NULL,
          position_id uuid,
          tenant_id uuid NOT NULL,
          reports_to_id uuid,
          created_by uuid,
          created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          currency character varying(3) DEFAULT 'USD'::character varying NOT NULL
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY employment
          ADD CONSTRAINT employment_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_employment_reports_to ON employment USING btree (reports_to_id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY employment
          ADD CONSTRAINT fk_employment_created_by FOREIGN KEY (created_by) REFERENCES tenant_members(id) ON DELETE SET NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY employment
          ADD CONSTRAINT fk_employment_position FOREIGN KEY (position_id) REFERENCES "position"(id) ON DELETE RESTRICT;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY employment
          ADD CONSTRAINT fk_employment_reports_to FOREIGN KEY (reports_to_id) REFERENCES tenant_members(id) ON DELETE SET NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY employment
          ADD CONSTRAINT fk_employment_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY employment
          ADD CONSTRAINT fk_employment_tenant_member FOREIGN KEY (tenant_member_id) REFERENCES tenant_members(id) ON DELETE CASCADE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "employment";`);
  }
}
