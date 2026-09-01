import { Global, Module } from '@nestjs/common';
import { IntegrationAnalyticsListener } from './integration-analytics.listener';
import { ProductAnalyticsService } from './product-analytics.service';

@Global()
@Module({
  providers: [ProductAnalyticsService, IntegrationAnalyticsListener],
  exports: [ProductAnalyticsService],
})
export class ObservabilityModule {}
