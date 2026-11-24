import type { MigrationInterface, QueryRunner } from 'typeorm';

export class RewardsTaskSubmissions1795450741378 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE rewards_task_submissions (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          tenant_id uuid NOT NULL,
          task_id uuid NOT NULL,
          member_id uuid NOT NULL,
          status character varying DEFAULT 'pending'::character varying,
          submission_text text,
          submission_file_name character varying,
          created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY rewards_task_submissions
          ADD CONSTRAINT rewards_task_submissions_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_task_submissions_member_id ON rewards_task_submissions USING btree (member_id);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_task_submissions_task_id ON rewards_task_submissions USING btree (task_id);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_task_submissions_tenant_id ON rewards_task_submissions USING btree (tenant_id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY rewards_task_submissions
          ADD CONSTRAINT fk_task_submissions_member FOREIGN KEY (member_id) REFERENCES tenant_members(id) ON DELETE CASCADE;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY rewards_task_submissions
          ADD CONSTRAINT fk_task_submissions_task FOREIGN KEY (task_id) REFERENCES rewards_tasks(id) ON DELETE CASCADE;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY rewards_task_submissions
          ADD CONSTRAINT fk_task_submissions_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "rewards_task_submissions";`);
  }
}
