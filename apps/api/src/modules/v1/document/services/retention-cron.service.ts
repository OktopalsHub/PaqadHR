import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DocumentRetentionPolicy } from 'src/common/enums/document-retention-policy.enum';
import { DocumentType } from 'src/common/enums/document-type.enum';
import { runCronJob } from 'src/common/utils/cron-logging.util';
import { LessThan, Repository } from 'typeorm';
import { getDocumentRetentionPolicy } from '../entities/document.entity';
import { Document } from '../entities/document.entity';

const TEMPORARY_RETENTION_DAYS = 90;

@Injectable()
export class RetentionCronService {
  private readonly logger = new Logger(RetentionCronService.name);

  constructor(
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeExpiredDocuments(): Promise<void> {
    await runCronJob(this.logger, 'document-retention', async () => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - TEMPORARY_RETENTION_DAYS);

      const candidates = await this.documentRepository.find({
        where: { createdAt: LessThan(cutoff) },
        take: 200,
      });

      let purged = 0;
      for (const document of candidates) {
        const policy = getDocumentRetentionPolicy(document.type as DocumentType);
        if (policy !== DocumentRetentionPolicy.TEMPORARY) {
          continue;
        }
        await this.documentRepository.delete(document.id);
        purged += 1;
      }

      return { purged };
    });
  }
}
