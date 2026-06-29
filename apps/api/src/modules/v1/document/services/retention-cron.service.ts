import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { runCronJob } from 'src/common/utils/cron-logging.util';
import { In, LessThan } from 'typeorm';
import { DocumentRepository } from '../document.repository';
import { DocumentService } from '../document.service';
import { getTemporaryDocumentTypes } from '../entities/document.entity';

const TEMPORARY_RETENTION_DAYS = 90;

@Injectable()
export class RetentionCronService {
  private readonly logger = new Logger(RetentionCronService.name);

  constructor(
    private readonly documentRepository: DocumentRepository,
    private readonly documentService: DocumentService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeExpiredDocuments(): Promise<void> {
    await runCronJob(this.logger, 'document-retention', async () => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - TEMPORARY_RETENTION_DAYS);

      const temporaryTypes = getTemporaryDocumentTypes();
      if (temporaryTypes.length === 0) {
        return { purged: 0 };
      }

      const candidates = await this.documentRepository.find({
        where: {
          createdAt: LessThan(cutoff),
          type: In(temporaryTypes),
        },
        take: 200,
      });

      let purged = 0;
      for (const document of candidates) {
        await this.documentService.purgeExpiredDocument(document);
        purged += 1;
      }

      return { purged };
    });
  }
}
