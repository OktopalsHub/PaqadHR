import type { MigrationInterface, QueryRunner } from 'typeorm';

export class TenantMembers1781241212614 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE tenant_members (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        first_name VARCHAR(50),
        last_name VARCHAR(50),
        middle_name VARCHAR(50),
        preferred_name VARCHAR(50),
        phone VARCHAR(15),
        date_of_birth DATE,
        gender VARCHAR(16),
        role VARCHAR(16) NOT NULL DEFAULT 'MEMBER',
        is_active BOOLEAN NOT NULL DEFAULT true,
        join_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        leave_date TIMESTAMP,
        avatar_key VARCHAR(100),
        user_id UUID NOT NULL,
        tenant_id UUID NOT NULL,
        employee_number VARCHAR(7),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT fk_tenant_members_user FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE,
        CONSTRAINT fk_tenant_members_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
        CONSTRAINT uq_tenant_employee_number UNIQUE (tenant_id, employee_number)
      );
    `);

    await queryRunner.query(
      `CREATE INDEX idx_tenant_member_tenant_active ON tenant_members(tenant_id, is_active);`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE tenant_members;`);
  }
}
