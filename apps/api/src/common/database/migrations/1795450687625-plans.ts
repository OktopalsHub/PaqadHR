import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Plans1795450687625 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE plans (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          slug character varying(50) NOT NULL,
          name character varying(100) NOT NULL,
          description text,
          features jsonb DEFAULT '{}'::jsonb,
          limits jsonb DEFAULT '{}'::jsonb,
          sort_order integer DEFAULT 0,
          is_active boolean DEFAULT true,
          created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY plans
          ADD CONSTRAINT plans_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY plans
          ADD CONSTRAINT plans_slug_key UNIQUE (slug);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_plans_is_active ON plans USING btree (is_active);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "plans";`);
  }
}
