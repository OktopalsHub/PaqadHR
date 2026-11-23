import type { MigrationInterface, QueryRunner } from 'typeorm';

export class RecruitmentOffer1795450721416 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE recruitment_offer (
          id uuid DEFAULT gen_random_uuid() NOT NULL,
          created_at timestamp without time zone DEFAULT now() NOT NULL,
          updated_at timestamp without time zone DEFAULT now() NOT NULL,
          tenant_id uuid NOT NULL,
          candidate_id uuid NOT NULL,
          amount numeric(14,2) NOT NULL,
          currency character varying(3) NOT NULL,
          start_date date,
          status character varying(16) DEFAULT 'DRAFT'::character varying NOT NULL,
          notes text,
          sent_at timestamp without time zone,
          responded_at timestamp without time zone,
          created_by_member_id uuid,
          CONSTRAINT ck_recruitment_offer_status CHECK (((status)::text = ANY ((ARRAY['DRAFT'::character varying, 'SENT'::character varying, 'ACCEPTED'::character varying, 'DECLINED'::character varying])::text[]))),
          CONSTRAINT recruitment_offer_amount_check CHECK ((amount > (0)::numeric))
      );
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY recruitment_offer
          ADD CONSTRAINT recruitment_offer_pkey PRIMARY KEY (id);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_recruitment_offer_candidate ON recruitment_offer USING btree (tenant_id, candidate_id);
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY recruitment_offer
          ADD CONSTRAINT recruitment_offer_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES candidate(id) ON DELETE CASCADE;
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY recruitment_offer
          ADD CONSTRAINT recruitment_offer_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_recruitment_offer_open_per_candidate ON recruitment_offer (candidate_id) WHERE status IN ('DRAFT', 'SENT');
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "recruitment_offer";`);
  }
}
