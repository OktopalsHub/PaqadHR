import * as Sentry from '@sentry/nextjs';
import { sanitizeSentryEvent } from './lib/observability/sanitize-sentry-event';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
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

export { Sentry };
