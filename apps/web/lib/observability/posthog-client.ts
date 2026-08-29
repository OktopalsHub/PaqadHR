import posthog from 'posthog-js';

let initialized = false;

export function initPostHog(): void {
  if (initialized || typeof window === 'undefined') return;

  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim();
  if (!apiKey) return;

  posthog.init(apiKey, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || 'https://eu.i.posthog.com',
    persistence: 'memory',
    autocapture: false,
    capture_pageview: false,
    disable_session_recording: true,
    person_profiles: 'identified_only',
  });

  initialized = true;
}

export function capturePageview(path?: string): void {
  if (!initialized) return;
  posthog.capture('$pageview', path ? { $current_url: path } : undefined);
}

export function identifyUser(userId: string): void {
  if (!initialized || !userId) return;
  posthog.identify(userId);
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
