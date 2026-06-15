import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Employment1781241265242 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE employment (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        start_date DATE NOT NULL,
        end_date DATE,
        status VARCHAR(16) NOT NULL DEFAULT 'active',
        pay_type VARCHAR(16) NOT NULL DEFAULT 'salary',
        pay_schedule VARCHAR(16) NOT NULL DEFAULT 'monthly',
        pay_rate DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        comments TEXT,
        tenant_member_id UUID NOT NULL,
        position_id UUID NOT NULL,
        tenant_id UUID NOT NULL,
        reports_to_id UUID,
        created_by UUID,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT fk_employment_tenant_member FOREIGN KEY (tenant_member_id) REFERENCES tenant_members(id) ON DELETE CASCADE,
        CONSTRAINT fk_employment_position FOREIGN KEY (position_id) REFERENCES position(id) ON DELETE RESTRICT,
        CONSTRAINT fk_employment_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
        CONSTRAINT fk_employment_reports_to FOREIGN KEY (reports_to_id) REFERENCES tenant_members(id) ON DELETE SET NULL,
        CONSTRAINT fk_employment_created_by FOREIGN KEY (created_by) REFERENCES tenant_members(id) ON DELETE SET NULL
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE employment;`);
  }
}
