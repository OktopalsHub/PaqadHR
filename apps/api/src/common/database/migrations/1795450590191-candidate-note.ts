import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CandidateNote1795450590191 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE candidate_note (
          id uuid DEFAULT uuid_generate_v4() NOT NULL,
          candidate_id uuid NOT NULL,
          user_id uuid NOT NULL,
          content text NOT NULL,
          tenant_member_id uuid NOT NULL,
          tenant_id uuid NOT NULL,
          created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
          deleted_at timestamp without time zone
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY candidate_note
          ADD CONSTRAINT candidate_note_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY candidate_note
          ADD CONSTRAINT fk_candidate_note_candidate FOREIGN KEY (candidate_id) REFERENCES candidate(id) ON DELETE CASCADE;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY candidate_note
          ADD CONSTRAINT fk_candidate_note_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY candidate_note
          ADD CONSTRAINT fk_candidate_note_tenant_member FOREIGN KEY (tenant_member_id) REFERENCES tenant_members(id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY candidate_note
          ADD CONSTRAINT fk_candidate_note_user FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "candidate_note";`);
  }
}
