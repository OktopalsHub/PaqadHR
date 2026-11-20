import type { MigrationInterface, QueryRunner } from 'typeorm';

export class RecruitmentScorecardsOffersPool1794700000000 implements MigrationInterface {
  name = 'RecruitmentScorecardsOffersPool1794700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE recruitment_scorecard (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        candidate_id uuid NOT NULL REFERENCES candidate(id) ON DELETE CASCADE,
        reviewer_member_id uuid NOT NULL,
        ratings jsonb NOT NULL,
        recommendation varchar(16) NOT NULL,
        notes text,
        CONSTRAINT uq_recruitment_scorecard_reviewer UNIQUE (candidate_id, reviewer_member_id),
        CONSTRAINT ck_recruitment_scorecard_recommendation
          CHECK (recommendation IN ('STRONG_YES', 'YES', 'NO', 'STRONG_NO'))
      );
      CREATE INDEX idx_recruitment_scorecard_candidate
        ON recruitment_scorecard (tenant_id, candidate_id);

      CREATE TABLE recruitment_offer (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        candidate_id uuid NOT NULL REFERENCES candidate(id) ON DELETE CASCADE,
        amount numeric(14,2) NOT NULL CHECK (amount > 0),
        currency varchar(3) NOT NULL,
        start_date date,
        status varchar(16) NOT NULL DEFAULT 'DRAFT',
        notes text,
        sent_at timestamp,
        responded_at timestamp,
        created_by_member_id uuid,
        CONSTRAINT ck_recruitment_offer_status
          CHECK (status IN ('DRAFT', 'SENT', 'ACCEPTED', 'DECLINED'))
      );
      CREATE INDEX idx_recruitment_offer_candidate
        ON recruitment_offer (tenant_id, candidate_id);

      ALTER TABLE candidate ADD COLUMN talent_pool boolean NOT NULL DEFAULT false;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE candidate DROP COLUMN IF EXISTS talent_pool;
      DROP TABLE IF EXISTS recruitment_offer;
      DROP TABLE IF EXISTS recruitment_scorecard;
    `);
  }
}
