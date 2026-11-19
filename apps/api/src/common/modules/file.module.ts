import { Module } from '@nestjs/common';

import { CloudflareR2Service } from '../services/cloudflare-r2.service';
import { FileUrlService } from '../services/file-url.service';
import { FileService } from '../services/file.service';

@Module({
  providers: [FileService, CloudflareR2Service, FileUrlService],
  exports: [FileService, CloudflareR2Service, FileUrlService],
})
export class FileModule {}
