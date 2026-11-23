import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Leaves1795450646207 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE leaves (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          reviewed_at timestamp without time zone,
          comments text,
          duration integer NOT NULL,
          leave_type_id uuid NOT NULL,
          start_date date NOT NULL,
          end_date date NOT NULL,
          status character varying(16) DEFAULT 'pending'::character varying NOT NULL,
          reason text,
          approved_by uuid,
          requested_by uuid NOT NULL,
          tenant_id uuid NOT NULL,
          created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          deleted_at timestamp without time zone
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY leaves
          ADD CONSTRAINT leaves_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_leaves_tenant_member_status ON leaves USING btree (tenant_id, requested_by, status);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_leaves_tenant_start ON leaves USING btree (tenant_id, start_date DESC);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY leaves
          ADD CONSTRAINT fk_leaves_approved_by FOREIGN KEY (approved_by) REFERENCES tenant_members(id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY leaves
          ADD CONSTRAINT fk_leaves_leave_type FOREIGN KEY (leave_type_id) REFERENCES leave_types(id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY leaves
          ADD CONSTRAINT fk_leaves_requested_by FOREIGN KEY (requested_by) REFERENCES tenant_members(id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY leaves
          ADD CONSTRAINT fk_leaves_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "leaves";`);
  }
}
