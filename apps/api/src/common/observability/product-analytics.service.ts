import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { PostHog } from 'posthog-node';
import { getRequestCorrelationId } from './correlation-id.storage';
import { sanitizeAnalyticsProperties } from './sanitize-analytics-properties';

export type ProductAnalyticsContext = {
  userId?: string;
  tenantId?: string;
  role?: string;
  plan?: string;
  correlationId?: string;
};

@Injectable()
export class ProductAnalyticsService implements OnModuleDestroy {
  private readonly logger = new Logger(ProductAnalyticsService.name);
  private readonly client: PostHog | null;

  constructor() {
    const apiKey = process.env.POSTHOG_API_KEY?.trim();
    const host = process.env.POSTHOG_HOST?.trim() || 'https://eu.i.posthog.com';

    if (!apiKey) {
      this.client = null;
      return;
    }

    this.client = new PostHog(apiKey, {
      host,
      flushAt: 1,
      flushInterval: 0,
    });
  }

  capture(
    distinctId: string,
    event: string,
    context: ProductAnalyticsContext = {},
    properties?: Record<string, unknown>,
  ): void {
    if (!this.client || !distinctId) return;

    const merged = {
      tenant_id: context.tenantId,
      role: context.role,
      plan: context.plan,
      correlation_id: context.correlationId ?? getRequestCorrelationId(),
      ...properties,
    };

    const sanitized = sanitizeAnalyticsProperties(merged);

    setImmediate(() => {
      try {
        this.client?.capture({
          distinctId,
          event,
          properties: sanitized,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`PostHog capture failed for ${event}: ${message}`);
      }
    });
  }

  identify(distinctId: string, context: ProductAnalyticsContext = {}): void {
    if (!this.client || !distinctId) return;

    const properties = sanitizeAnalyticsProperties({
      tenant_id: context.tenantId,
      role: context.role,
      plan: context.plan,
    });

    setImmediate(() => {
      try {
        this.client?.identify({
          distinctId,
          properties,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`PostHog identify failed: ${message}`);
      }
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.shutdown();
    } catch {
      // Best-effort shutdown.
    }
  }
}
