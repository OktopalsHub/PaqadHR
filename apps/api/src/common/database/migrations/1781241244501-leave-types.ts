import { MigrationInterface, QueryRunner } from 'typeorm';

export class LeaveTypes1781241244501 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE leave_types (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        name VARCHAR(100) NOT NULL,
        description TEXT NOT NULL,
        default_days INT NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT true,
        tenant_id UUID NOT NULL,
        tenant_member_id UUID NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT fk_leave_types_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
        CONSTRAINT fk_leave_types_tenant_member FOREIGN KEY (tenant_member_id) REFERENCES tenant_members(id) ON DELETE SET NULL
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE leave_types;`);
  }
}
