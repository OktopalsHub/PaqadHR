import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Account1795450557469 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE account (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          user_id uuid,
          account_id character varying(255),
          provider_id character varying(255),
          access_token text,
          refresh_token text,
          id_token text,
          access_token_expires_at timestamp without time zone,
          refresh_token_expires_at timestamp without time zone,
          scope text,
          password text,
          created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY account
          ADD CONSTRAINT account_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_account_provider ON account USING btree (provider_id, account_id) WHERE ((provider_id IS NOT NULL) AND (account_id IS NOT NULL));
    `);
    await queryRunner.query(`
      CREATE INDEX idx_account_user_id ON account USING btree (user_id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY account
          ADD CONSTRAINT fk_account_user FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "account";`);
  }
}
