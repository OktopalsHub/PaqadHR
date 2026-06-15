import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Tenants1781241207756 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE tenants (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        name VARCHAR(50) NOT NULL,
        slug VARCHAR(25) NOT NULL UNIQUE,
        is_active BOOLEAN NOT NULL DEFAULT true,
        invite_code VARCHAR(6) NOT NULL UNIQUE,
        employee_code VARCHAR(10),
        logo_key VARCHAR(100),
        industry VARCHAR(50),
        company_size VARCHAR(50),
        location VARCHAR(100),
        country_code VARCHAR(2),
        timezone VARCHAR(50) DEFAULT 'UTC',
        preferred_currency VARCHAR(3),
        pricing_locked BOOLEAN DEFAULT false,
        created_by UUID NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT fk_tenants_created_by FOREIGN KEY (created_by) REFERENCES "user"(id) ON DELETE SET NULL
      );
    `);

    await queryRunner.query(`CREATE INDEX idx_tenant_is_active ON tenants(is_active);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE tenants;`);
  }
}
