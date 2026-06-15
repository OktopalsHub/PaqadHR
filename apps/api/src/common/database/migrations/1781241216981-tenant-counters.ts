import type { MigrationInterface, QueryRunner } from 'typeorm';

export class TenantCounters1781241216981 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE tenant_counters (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL,
        counter_type VARCHAR(50) NOT NULL,
        current_value INT NOT NULL DEFAULT 0,
        prefix VARCHAR(10),
        suffix VARCHAR(10),
        padding_length INT DEFAULT 3,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_tenant_counter_type UNIQUE (tenant_id, counter_type),
        CONSTRAINT fk_tenant_counters_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      );
    `);

    await queryRunner.query(
      `CREATE INDEX idx_tenant_counters_lookup ON tenant_counters(tenant_id, counter_type);`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE tenant_counters;`);
  }
}
