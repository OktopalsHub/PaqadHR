import { MigrationInterface, QueryRunner } from 'typeorm';

export class Departments1781241226267 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE departments (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        name VARCHAR(100) NOT NULL,
        description TEXT,
        manager_id UUID,
        parent_id UUID,
        tenant_id UUID NOT NULL,
        created_by UUID NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT fk_departments_manager FOREIGN KEY (manager_id) REFERENCES tenant_members(id) ON DELETE SET NULL,
        CONSTRAINT fk_departments_parent FOREIGN KEY (parent_id) REFERENCES departments(id) ON DELETE SET NULL,
        CONSTRAINT fk_departments_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
        CONSTRAINT fk_departments_created_by FOREIGN KEY (created_by) REFERENCES tenant_members(id) ON DELETE SET NULL
      );
    `);

    await queryRunner.query(`CREATE INDEX idx_departments_tenant_id ON departments(tenant_id);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE departments;`);
  }
}
