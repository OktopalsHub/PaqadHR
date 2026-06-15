import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Invitations1781241292545 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE invitations (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        email VARCHAR(100) NOT NULL,
        tenant_id UUID NOT NULL,
        first_name VARCHAR(50) NOT NULL,
        last_name VARCHAR(50) NOT NULL,
        middle_name VARCHAR(50),
        job_title VARCHAR(100),
        department_id UUID,
        employment_type VARCHAR(50),
        employee_number VARCHAR(20),
        position_id UUID,
        role VARCHAR(32) NOT NULL DEFAULT 'member',
        status VARCHAR(16) NOT NULL DEFAULT 'pending',
        invited_by UUID NOT NULL,
        token VARCHAR(255) NOT NULL UNIQUE,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT fk_invitations_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
        CONSTRAINT fk_invitations_invited_by FOREIGN KEY (invited_by) REFERENCES tenant_members(id) ON DELETE CASCADE,
        CONSTRAINT fk_invitations_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
        CONSTRAINT fk_invitations_position FOREIGN KEY (position_id) REFERENCES position(id) ON DELETE SET NULL
      );
    `);

    await queryRunner.query(`CREATE INDEX idx_invitations_tenant_id ON invitations(tenant_id);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE invitations;`);
  }
}
