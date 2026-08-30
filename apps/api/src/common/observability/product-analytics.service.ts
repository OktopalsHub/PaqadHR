import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { PostHog } from 'posthog-node';
import { pseudonymizeAnalyticsIdentifier } from './pseudonymize-analytics-identifier';
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
  private readonly identifierSalt: string | null;

  constructor() {
    const apiKey = process.env.POSTHOG_API_KEY?.trim();
    const identifierSalt = process.env.POSTHOG_IDENTIFIER_SALT?.trim();
    const host = process.env.POSTHOG_HOST?.trim() || 'https://eu.i.posthog.com';

    if (!apiKey || !identifierSalt) {
      this.client = null;
      this.identifierSalt = null;
      return;
    }

    this.identifierSalt = identifierSalt;
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
    const identifierSalt = this.identifierSalt;
    if (!this.client || !distinctId || !identifierSalt) return;

    const merged = {
      tenant_id: context.tenantId
        ? pseudonymizeAnalyticsIdentifier('tenant', context.tenantId, identifierSalt)
        : undefined,
      role: context.role,
      plan: context.plan,
      ...properties,
    };

    const sanitized = sanitizeAnalyticsProperties(merged);

    setImmediate(() => {
      try {
        this.client?.capture({
          distinctId: pseudonymizeAnalyticsIdentifier('actor', distinctId, identifierSalt),
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
    const identifierSalt = this.identifierSalt;
    if (!this.client || !distinctId || !identifierSalt) return;

    const properties = sanitizeAnalyticsProperties({
      tenant_id: context.tenantId
        ? pseudonymizeAnalyticsIdentifier('tenant', context.tenantId, identifierSalt)
        : undefined,
      role: context.role,
      plan: context.plan,
    });

    setImmediate(() => {
      try {
        this.client?.identify({
          distinctId: pseudonymizeAnalyticsIdentifier('actor', distinctId, identifierSalt),
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
