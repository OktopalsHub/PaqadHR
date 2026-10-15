import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ProductAnalyticsService } from './product-analytics.service';

type IntegrationConnectedEvent = {
  tenantId: string;
  platform?: string;
  integrationId?: string;
};

@Injectable()
export class IntegrationAnalyticsListener {
  constructor(private readonly productAnalytics: ProductAnalyticsService) {}

  @OnEvent('integration.connected')
  handleIntegrationConnected(event: IntegrationConnectedEvent): void {
    this.productAnalytics.capture(
      'system',
      'integration_connected',
      { tenantId: event.tenantId },
      { platform: event.platform ?? 'unknown' },
    );
  }

  @OnEvent('integration.failed')
  handleIntegrationFailed(event: IntegrationConnectedEvent): void {
    this.productAnalytics.capture(
      'system',
      'integration_failed',
      { tenantId: event.tenantId },
      { platform: event.platform ?? 'unknown' },
    );
  }
}
