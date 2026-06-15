import type { MigrationInterface, QueryRunner } from 'typeorm';

export class JobOpening1781241300448 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE job_opening (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        title VARCHAR NOT NULL,
        department_id UUID,
        position VARCHAR NOT NULL,
        employment_type VARCHAR(16) NOT NULL,
        experience_level VARCHAR(50) DEFAULT 'Mid-Level',
        location JSON NOT NULL,
        description TEXT NOT NULL,
        requirements JSON NOT NULL,
        responsibilities JSON NOT NULL,
        preferred_qualifications JSON,
        required_skills JSON,
        minimum_salary DECIMAL(10,2),
        maximum_salary DECIMAL(10,2),
        currency VARCHAR,
        benefits JSON,
        status VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
        is_urgent BOOLEAN NOT NULL DEFAULT false,
        published_at TIMESTAMP,
        closed_at TIMESTAMP,
        custom_questions JSON,
        hiring_manager_id UUID,
        number_of_openings INTEGER,
        application_deadline TIMESTAMP,
        tenant_member_id UUID NOT NULL,
        tenant_id UUID NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT fk_job_opening_department FOREIGN KEY (department_id) REFERENCES departments(id),
        CONSTRAINT fk_job_opening_tenant_member FOREIGN KEY (tenant_member_id) REFERENCES tenant_members(id),
        CONSTRAINT fk_job_opening_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      );
    `);

    await queryRunner.query(`CREATE INDEX idx_job_opening_tenant ON job_opening(tenant_id);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE job_opening;`);
  }
}
