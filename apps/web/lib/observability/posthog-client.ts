import type { PostHog } from 'posthog-js';
import { type Attribution, attributionEventProperties } from '@/lib/observability/attribution';

type PostHogClient = Pick<PostHog, 'capture' | 'identify' | 'register' | 'reset'>;
type QueuedAction = (client: PostHogClient) => void;

const MAX_QUEUE = 20;

let client: PostHogClient | null = null;
let loading: Promise<void> | null = null;
const queue: QueuedAction[] = [];

function runOrQueue(action: QueuedAction): void {
  if (client) {
    action(client);
    return;
  }
  // Keep the first events (attribution, first pageview) if PostHog is slow.
  if (queue.length >= MAX_QUEUE) queue.shift();
  queue.push(action);
}

function flush(nextClient: PostHogClient): void {
  client = nextClient;
  for (const action of queue.splice(0)) action(nextClient);
}

/**
 * Loads the PostHog bundle on demand instead of shipping it in the initial
 * client bundle, then replays anything captured while it was loading.
 */
export function initPostHog(): void {
  if (client || loading || typeof window === 'undefined') return;

  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim();
  if (!apiKey) return;

  loading = import('posthog-js')
    .then(({ default: posthog }) => {
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
      flush(posthog);
    })
    .catch(() => {
      loading = null;
    });
}

/**
 * Binds the session to the same pseudonymised distinct id the API uses, so browser
 * and server events land on one PostHog person. The raw user id never leaves the app.
 */
export function identifyPostHog(distinctId: string): void {
  if (!distinctId) return;
  runOrQueue((posthog) => posthog.identify(distinctId));
}

export function capturePageview(path?: string): void {
  runOrQueue((posthog) => posthog.capture('$pageview', path ? { $current_url: path } : undefined));
}

/**
 * Registers campaign attribution as super properties so every subsequent event
 * (pageview, signup, billing) carries where the visitor came from.
 */
export function registerAttribution(attribution: Attribution | null | undefined): void {
  const properties = attributionEventProperties(attribution);
  if (Object.keys(properties).length === 0) return;
  runOrQueue((posthog) => posthog.register(properties));
}

export function captureClientEvent(
  event: string,
  properties?: Record<string, string | number | boolean>,
): void {
  runOrQueue((posthog) => posthog.capture(event, properties));
}

export function resetPostHog(): void {
  runOrQueue((posthog) => posthog.reset());
}
