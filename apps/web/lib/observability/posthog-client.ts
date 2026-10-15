import posthog from 'posthog-js';

let initialized = false;

export function initPostHog(): void {
  if (initialized || typeof window === 'undefined') return;

  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim();
  if (!apiKey) return;

  posthog.init(apiKey, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || 'https://eu.i.posthog.com',
    // 'memory' handed out a brand-new anonymous id on every full page load, so no
    // visitor could ever be stitched back together across reloads.
    persistence: 'localStorage',
    autocapture: false,
    capture_pageview: false,
    disable_session_recording: true,
    person_profiles: 'identified_only',
  });

  initialized = true;
}

/**
 * Binds the session to the same pseudonymised distinct id the API uses, so browser
 * and server events land on one PostHog person. The raw user id never leaves the app.
 */
export function identifyPostHog(distinctId: string): void {
  if (!initialized || !distinctId) return;
  posthog.identify(distinctId);
}

export function capturePageview(path?: string): void {
  if (!initialized) return;
  posthog.capture('$pageview', path ? { $current_url: path } : undefined);
}

export function captureClientEvent(
  event: string,
  properties?: Record<string, string | number | boolean>,
): void {
  if (!initialized) return;
  posthog.capture(event, properties);
}

export function resetPostHog(): void {
  if (!initialized) return;
  posthog.reset();
}
