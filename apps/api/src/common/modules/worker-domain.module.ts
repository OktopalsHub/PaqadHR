import { Module } from '@nestjs/common';
import { WorkerDomainService } from '../services/worker-domain.service';

@Module({
  providers: [WorkerDomainService],
  exports: [WorkerDomainService],
})
export class WorkerDomainModule {}
