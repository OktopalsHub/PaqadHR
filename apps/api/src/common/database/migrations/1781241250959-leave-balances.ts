import { MigrationInterface, QueryRunner } from 'typeorm';

export class LeaveBalances1781241250959 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE leave_balances (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        member_id UUID NOT NULL,
        leave_type_id UUID NOT NULL,
        total_days INTEGER NOT NULL,
        used_days INTEGER NOT NULL,
        remaining_days INTEGER NOT NULL,
        carryover_days INTEGER DEFAULT 0,
        regular_days INTEGER,
        carryover_expiry_date DATE,
        carryover_used INTEGER DEFAULT 0,
        year INTEGER NOT NULL,
        tenant_id UUID NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT fk_leave_balances_member FOREIGN KEY (member_id) REFERENCES tenant_members(id) ON DELETE CASCADE,
        CONSTRAINT fk_leave_balances_leave_type FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE CASCADE,
        CONSTRAINT fk_leave_balances_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE leave_balances;`);
  }
}
