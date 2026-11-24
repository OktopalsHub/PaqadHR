import type { MigrationInterface, QueryRunner } from 'typeorm';

export class LeavePolicies1795450642434 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE leave_policies (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          tenant_id uuid NOT NULL,
          allow_carryover boolean DEFAULT false,
          max_carryover_days integer DEFAULT 0,
          carryover_expiry_months integer,
          auto_create_annual_balances boolean DEFAULT true,
          prorate_for_new_joiners boolean DEFAULT true,
          created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY leave_policies
          ADD CONSTRAINT leave_policies_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY leave_policies
          ADD CONSTRAINT fk_leave_policies_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "leave_policies";`);
  }
}
