import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CandidateNote1781241310923 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE candidate_note (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        candidate_id UUID NOT NULL,
        user_id UUID NOT NULL,
        content TEXT NOT NULL,
        tenant_member_id UUID NOT NULL,
        tenant_id UUID NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT fk_candidate_note_candidate FOREIGN KEY (candidate_id) REFERENCES candidate(id) ON DELETE CASCADE,
        CONSTRAINT fk_candidate_note_user FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE,
        CONSTRAINT fk_candidate_note_tenant_member FOREIGN KEY (tenant_member_id) REFERENCES tenant_members(id),
        CONSTRAINT fk_candidate_note_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE candidate_note;`);
  }
}
