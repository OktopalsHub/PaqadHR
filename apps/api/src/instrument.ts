import * as Sentry from '@sentry/nestjs';
import { sanitizeSentryEvent } from './common/observability/sanitize-sentry-event';

const dsn = process.env.SENTRY_DSN?.trim();
const isProduction = process.env.NODE_ENV === 'production';

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: isProduction ? 0.15 : 0,
    sendDefaultPii: false,
    beforeSend(event) {
      return sanitizeSentryEvent(event);
    },
  });
}
