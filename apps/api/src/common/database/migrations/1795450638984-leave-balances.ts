import type { MigrationInterface, QueryRunner } from 'typeorm';

export class LeaveBalances1795450638984 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE leave_balances (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          member_id uuid NOT NULL,
          leave_type_id uuid NOT NULL,
          total_days integer NOT NULL,
          used_days integer NOT NULL,
          remaining_days integer NOT NULL,
          carryover_days integer DEFAULT 0,
          regular_days integer,
          carryover_expiry_date date,
          carryover_used integer DEFAULT 0,
          year integer NOT NULL,
          tenant_id uuid NOT NULL,
          created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          deleted_at timestamp without time zone
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY leave_balances
          ADD CONSTRAINT leave_balances_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY leave_balances
          ADD CONSTRAINT fk_leave_balances_leave_type FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE CASCADE;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY leave_balances
          ADD CONSTRAINT fk_leave_balances_member FOREIGN KEY (member_id) REFERENCES tenant_members(id) ON DELETE CASCADE;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY leave_balances
          ADD CONSTRAINT fk_leave_balances_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "leave_balances";`);
  }
}
