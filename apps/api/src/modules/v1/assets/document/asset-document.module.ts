import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileModule } from '../../../../common/modules/file.module';
import { AssetDocumentController } from './asset-document.controller';
import { AssetDocumentService } from './asset-document.service';
import { AssetDocument } from './entities/asset-document.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AssetDocument]), FileModule],
  controllers: [AssetDocumentController],
  providers: [AssetDocumentService],
  exports: [AssetDocumentService],
})
export class AssetDocumentModule {}
