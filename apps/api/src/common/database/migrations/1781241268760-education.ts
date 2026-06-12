import { MigrationInterface, QueryRunner } from 'typeorm';

export class Education1781241268760 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE education (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        title VARCHAR(255) NOT NULL,
        degree_type VARCHAR(20) NOT NULL,
        institution VARCHAR(255) NOT NULL,
        field_of_study VARCHAR(100),
        start_date DATE,
        end_date DATE,
        description TEXT,
        gpa VARCHAR(10),
        tenant_member_id UUID NOT NULL,
        tenant_id UUID NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT fk_education_tenant_member FOREIGN KEY (tenant_member_id) REFERENCES tenant_members(id) ON DELETE CASCADE,
        CONSTRAINT fk_education_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE education;`);
  }
}
