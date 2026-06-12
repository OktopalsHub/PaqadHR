import { MigrationInterface, QueryRunner } from 'typeorm';

export class AssetDocuments1781241286697 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE asset_documents (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL,
        type VARCHAR NOT NULL,
        document_name VARCHAR NOT NULL,
        image_key VARCHAR NOT NULL,
        size BIGINT,
        mime_type VARCHAR,
        metadata JSON,
        asset_id UUID NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT fk_asset_documents_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
        CONSTRAINT fk_asset_documents_asset FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE asset_documents;`);
  }
}
