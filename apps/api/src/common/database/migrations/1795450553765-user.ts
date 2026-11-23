import type { MigrationInterface, QueryRunner } from 'typeorm';

export class User1795450553765 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "user" (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          name character varying(100),
          email character varying(100) NOT NULL,
          password character varying(255),
          email_verified boolean DEFAULT false,
          country_code character(2),
          image_key character varying(100),
          is_active boolean DEFAULT true NOT NULL,
          role character varying(20) DEFAULT 'basic'::character varying,
          deleted_at timestamp without time zone,
          metadata jsonb,
          created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY "user"
          ADD CONSTRAINT user_email_key UNIQUE (email);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY "user"
          ADD CONSTRAINT user_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_user_country_code ON "user" USING btree (country_code);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_user_email ON "user" USING btree (email);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "user";`);
  }
}
