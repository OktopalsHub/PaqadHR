import type { MigrationInterface, QueryRunner } from 'typeorm';

export class EmergencyContact1781241272764 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE emergency_contact (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        full_name VARCHAR(100) NOT NULL,
        phone_number VARCHAR(20) NOT NULL,
        email VARCHAR(100),
        relationship VARCHAR(16) NOT NULL,
        address TEXT,
        is_primary BOOLEAN NOT NULL DEFAULT false,
        tenant_member_id UUID NOT NULL,
        tenant_id UUID NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT fk_emergency_contact_tenant_member FOREIGN KEY (tenant_member_id) REFERENCES tenant_members(id) ON DELETE CASCADE,
        CONSTRAINT fk_emergency_contact_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE emergency_contact;`);
  }
}
