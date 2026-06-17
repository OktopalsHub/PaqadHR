import * as Sentry from '@sentry/nestjs';

const sentryDsn = process.env.SENTRY_DSN?.trim();

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
  });
} else if (process.env.NODE_ENV === 'production') {
  console.warn('SENTRY_DSN is not set — error monitoring is disabled');
}
