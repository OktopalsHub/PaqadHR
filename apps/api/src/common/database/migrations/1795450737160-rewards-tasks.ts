import type { MigrationInterface, QueryRunner } from 'typeorm';

export class RewardsTasks1795450737160 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE rewards_tasks (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          tenant_id uuid NOT NULL,
          title character varying NOT NULL,
          description text NOT NULL,
          points integer NOT NULL,
          icon character varying NOT NULL,
          category character varying,
          image_url character varying,
          submission_type character varying DEFAULT 'instant'::character varying,
          created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          is_recurring boolean DEFAULT false NOT NULL
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY rewards_tasks
          ADD CONSTRAINT rewards_tasks_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_rewards_tasks_tenant_id ON rewards_tasks USING btree (tenant_id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY rewards_tasks
          ADD CONSTRAINT fk_rewards_tasks_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "rewards_tasks";`);
  }
}
