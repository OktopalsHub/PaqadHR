import { MigrationInterface, QueryRunner } from 'typeorm';

export class TeamMembers1781241239188 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE team_members (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        team_id UUID NOT NULL,
        member_id UUID NOT NULL,
        role VARCHAR(32),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT fk_team_members_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
        CONSTRAINT fk_team_members_member FOREIGN KEY (member_id) REFERENCES tenant_members(id) ON DELETE CASCADE
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE team_members;`);
  }
}
