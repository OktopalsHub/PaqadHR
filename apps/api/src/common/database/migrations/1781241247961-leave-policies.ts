import { MigrationInterface, QueryRunner } from 'typeorm';

export class LeavePolicies1781241247961 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE leave_policies (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL,
        allow_carryover BOOLEAN DEFAULT false,
        max_carryover_days INTEGER DEFAULT 0,
        carryover_expiry_months INTEGER,
        auto_create_annual_balances BOOLEAN DEFAULT true,
        prorate_for_new_joiners BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT fk_leave_policies_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE leave_policies;`);
  }
}
