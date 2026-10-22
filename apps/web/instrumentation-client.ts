import { loadSentry } from './lib/observability/sentry-client';

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

/**
 * Sentry is loaded after the page content, never in the initial bundle.
 *
 * A static `import * as Sentry from '@sentry/nextjs'` put the whole browser
 * SDK (~230 KB gzipped) into an eagerly fetched chunk on every page, including
 * the marketing pages. Loading it on idle keeps the SDK out of the critical
 * path while still initialising it on every page.
 */
const idleWindow = typeof window === 'undefined' ? undefined : (window as IdleWindow);

if (idleWindow) {
  if (idleWindow.requestIdleCallback) {
    idleWindow.requestIdleCallback(() => void loadSentry(), { timeout: 3000 });
  } else {
    window.setTimeout(() => void loadSentry(), 1500);
  }
}
