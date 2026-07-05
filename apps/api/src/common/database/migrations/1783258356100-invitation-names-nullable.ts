import type { MigrationInterface, QueryRunner } from 'typeorm';

export class InvitationNamesNullable1783258356100 implements MigrationInterface {
  name = 'InvitationNamesNullable1783258356100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE invitations
        ALTER COLUMN first_name DROP NOT NULL,
        ALTER COLUMN last_name DROP NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE invitations
      SET first_name = COALESCE(first_name, ''),
          last_name = COALESCE(last_name, '')
      WHERE first_name IS NULL OR last_name IS NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE invitations
        ALTER COLUMN first_name SET NOT NULL,
        ALTER COLUMN last_name SET NOT NULL;
    `);
  }
}
