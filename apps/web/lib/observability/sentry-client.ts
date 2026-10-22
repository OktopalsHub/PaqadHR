import { sanitizeSentryEvent } from './sanitize-sentry-event';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
const isProduction = process.env.NODE_ENV === 'production';

type SentryModule = typeof import('@sentry/nextjs');

let sentryPromise: Promise<SentryModule | null> | null = null;

/**
 * Load and initialise Sentry on demand.
 *
 * The browser SDK is ~230 KB gzipped. A static `import * as Sentry from
 * '@sentry/nextjs'` puts it in an eagerly loaded chunk on every page — it was
 * the single largest share of the first-load JavaScript on the marketing
 * pages. Loading it on idle (or on the first error) keeps it out of the
 * critical path.
 */
export function loadSentry(): Promise<SentryModule | null> {
  if (!dsn) return Promise.resolve(null);
  if (!sentryPromise) {
    sentryPromise = import('@sentry/nextjs')
      .then((Sentry) => {
        Sentry.init({
          dsn,
          environment: process.env.NODE_ENV ?? 'development',
          tracesSampleRate: isProduction ? 0.15 : 0,
          sendDefaultPii: false,
          beforeSend(event) {
            return sanitizeSentryEvent(event);
          },
        });
        return Sentry;
      })
      .catch(() => null);
  }
  return sentryPromise;
}

/** Report an exception without blocking the error boundary that called it. */
export async function captureSentryException(error: unknown): Promise<void> {
  try {
    const Sentry = await loadSentry();
    Sentry?.captureException(error);
  } catch {
    // Error reporting must never break the page it is reporting on.
  }
}
