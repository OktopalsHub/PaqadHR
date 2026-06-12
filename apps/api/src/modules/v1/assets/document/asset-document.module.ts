import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssetDocumentService } from './asset-document.service';
import { AssetDocumentController } from './asset-document.controller';
import { AssetDocument } from "./entities/asset-document.entity";
import { FileModule } from '../../../../common/modules/file.module';

@Module({
  imports: [TypeOrmModule.forFeature([AssetDocument]), FileModule],
  controllers: [AssetDocumentController],
  providers: [AssetDocumentService],
  exports: [AssetDocumentService],
})
export class AssetDocumentModule {}
