import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Session1795450745140 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE session (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          user_id uuid,
          expires_at timestamp without time zone NOT NULL,
          token text NOT NULL,
          ip_address character varying(45),
          user_agent text,
          created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY session
          ADD CONSTRAINT session_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY session
          ADD CONSTRAINT session_token_key UNIQUE (token);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_session_expires_at ON session USING btree (expires_at);
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_session_token ON session USING btree (token);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_session_user_id ON session USING btree (user_id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY session
          ADD CONSTRAINT fk_session_user FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "session";`);
  }
}
